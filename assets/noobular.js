/* ===========================================================================
   NOOBULAR MODE -- site-wide easter egg
   ---------------------------------------------------------------------------
   Type "noobular" anywhere on any page. Five seconds later the glass breaks
   and every word on the page turns into "noobular". Type it again and the
   glass un-breaks and everything snaps back right away -- the fuse is only
   on the way in.

   The mode is remembered in localStorage, so it follows you from page to page
   until you switch it off. Arriving on a page with it already on is silent:
   the sound marks the moment it flips, not every navigation.

   This file is deliberately pure ASCII. It is served without a charset, so a
   stray accented character gets decoded as Latin-1 and turns any regex that
   contains one into a syntax error.
   =========================================================================== */
(function () {
  'use strict';

  var WORD = 'noobular';
  var DELAY = 5000;                 // the fuse, in ms -- on the way IN only
  var KEY = 'noobular-mode';
  var SOUND = '/assets/sounds/glass%20breaking.m4a';

  var originals = null;             // Map<textNode, old text> while ON, null while OFF
  var pending = null;               // timer id while the fuse is burning
  var typed = '';                   // rolling buffer of the last few keystrokes
  var observer = null;
  var sweepQueued = false;

  /* A "word" for our purposes: a run of letters/digits, optionally carrying
     internal apostrophes or hyphens, so "america's game" and "noodle-based"
     each collapse to one noobular rather than two or three. Punctuation and
     whitespace stay exactly where they were. */
  var RUN = /[0-9A-Za-z]+(?:['-][0-9A-Za-z]+)*/g;
  var HAS_WORD = /[0-9A-Za-z]/;     // non-global, so .test() is not stateful

  /* Never touch text inside these -- rewriting a <script> body, or a textarea
     someone is typing into, would actually break something. */
  var OFF_LIMITS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1 };
  var OBS = { childList: true, subtree: true, characterData: true };

  /* ---- storage ----------------------------------------------------------
     Private browsing and blocked cookies both make localStorage throw rather
     than return null, so every access is wrapped. */
  function setFlag(on) {
    try {
      if (on) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }

  function flagged() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  /* ---- sound ------------------------------------------------------------
     Web Audio rather than an <audio> element, because an element can only
     play a file forwards and we need it backwards on the way out. */
  var actx = null, bufFwd = null, bufRev = null, loading = false;

  function audioContext() {
    if (actx) return actx;
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { actx = new C(); } catch (e) { actx = null; }
    return actx;
  }

  function reversed(ctx, buf) {
    var out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (var c = 0; c < buf.numberOfChannels; c++) {
      var src = buf.getChannelData(c);
      var dst = out.getChannelData(c);
      for (var i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
    }
    return out;
  }

  /* Called from the gesture that arms the egg, so the context is unlocked and
     the file is decoded well before the fuse burns down. */
  function primeAudio() {
    var ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended' && ctx.resume) {
      try { ctx.resume(); } catch (e) {}
    }
    if (bufFwd || loading) return;
    loading = true;
    fetch(SOUND).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(function (ab) {
      return new Promise(function (resolve, reject) {
        // Safari only implements the callback form, other browsers return a
        // promise; wiring up both is harmless.
        var p = ctx.decodeAudioData(ab, resolve, reject);
        if (p && p.then) p.then(resolve, reject);
      });
    }).then(function (buf) {
      bufFwd = buf;
      bufRev = reversed(ctx, buf);
    })['catch'](function () {
      loading = false;              // let a later trigger try again
    });
  }

  function play(buf) {
    var ctx = audioContext();
    if (ctx && buf) {
      try {
        var s = ctx.createBufferSource();
        s.buffer = buf;
        s.connect(ctx.destination);
        s.start(0);
        return;
      } catch (e) {}
    }
    // No Web Audio, or the decode never finished: forwards is better than
    // silent, and there is no way to reverse an <audio> element.
    if (buf === bufFwd || !buf) {
      try {
        var a = new Audio(SOUND);
        var p = a.play();
        if (p && p['catch']) p['catch'](function () {});
      } catch (e) {}
    }
  }

  /* ---- the swap ---------------------------------------------------------- */
  function offLimits(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      if (OFF_LIMITS[p.nodeName]) return true;
      p = p.parentNode;
    }
    return false;
  }

  /* Keep the shouting. This site is mostly ALL CAPS buttons, so a flat
     lowercase swap would quietly tone the whole place down. */
  function cased(match) {
    var upper = match.toUpperCase();
    var lower = match.toLowerCase();
    if (upper === lower) return WORD;                     // digits only
    if (match === upper && match.length > 1) return WORD.toUpperCase();
    if (match.charAt(0) === upper.charAt(0)) {
      return WORD.charAt(0).toUpperCase() + WORD.slice(1);
    }
    return WORD;
  }

  function textNodes() {
    var out = [];
    if (!document.body) return out;
    var walker = document.createTreeWalker(
      document.body, NodeFilter.SHOW_TEXT, null, false
    );
    var n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue || !HAS_WORD.test(n.nodeValue)) continue;
      if (offLimits(n)) continue;
      out.push(n);
    }
    return out;
  }

  /* Rewrite everything not already rewritten. Runs once on the way in and
     again whenever the page grows new text, which is what makes this work on
     the homepage (its buttons are built by newver.js after we load) and in
     the word game (which rebuilds its result line on every guess). */
  function sweep() {
    if (!originals) return;
    if (observer) observer.disconnect();     // don't react to our own writes
    var nodes = textNodes();
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var v = n.nodeValue;
      var swapped = v.replace(RUN, cased);
      if (!originals.has(n)) originals.set(n, v);
      if (swapped !== v) n.nodeValue = swapped;
    }
    if (observer) observer.observe(document.body, OBS);
  }

  function startObserver() {
    if (observer || !window.MutationObserver || !document.body) return;
    observer = new MutationObserver(function () {
      if (!originals || sweepQueued) return;
      sweepQueued = true;                    // coalesce bursts of mutations
      setTimeout(function () {
        sweepQueued = false;
        sweep();
      }, 120);
    });
    observer.observe(document.body, OBS);
  }

  function stopObserver() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  function turnOn(withSound) {
    if (originals) return;
    originals = new Map();
    sweep();
    startObserver();
    setFlag(true);
    if (withSound) play(bufFwd);
  }

  function turnOff(withSound) {
    if (!originals) return;
    stopObserver();
    /* Nodes detached since the swap are written back harmlessly and then
       garbage collected. */
    originals.forEach(function (text, node) { node.nodeValue = text; });
    originals = null;
    setFlag(false);
    if (withSound) play(bufRev);
  }

  function arm() {
    primeAudio();
    /* Going back is immediate: once the page is nothing but noobular there is
       no joke left in making someone wait to read it again. */
    if (originals) {
      if (pending) { clearTimeout(pending); pending = null; }
      turnOff(true);
      return;
    }
    if (pending) return;            // fuse already lit -- don't stack timers
    pending = setTimeout(function () {
      pending = null;
      turnOn(true);
    }, DELAY);
  }

  document.addEventListener('keydown', function (e) {
    /* Let real shortcuts through untouched, and ignore anything that is not a
       single printable character (Shift, Enter, arrows, F-keys...). */
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!e.key || e.key.length !== 1) return;

    typed = (typed + e.key).toLowerCase();
    if (typed.length > WORD.length) typed = typed.slice(-WORD.length);
    if (typed === WORD) {
      typed = '';
      arm();
    }
  });

  /* Nothing on the site calls this today -- the egg is keyboard-only. It is
     here so a button or a console poke can drive it without re-implementing
     the toggle. */
  window.noobularMode = {
    toggle: arm,
    isOn: function () { return !!originals; }
  };

  // Carried over from the last page: apply straight away, no fuse, no sound.
  if (flagged()) turnOn(false);
}());
