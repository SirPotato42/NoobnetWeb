/* ===========================================================================
   NOOBULAR MODE -- site-wide easter egg
   ---------------------------------------------------------------------------
   Type "noobular" anywhere on any page. Five seconds later, every word on the
   page turns into "noobular". Type it again and everything snaps back right
   away -- the fuse is only on the way in.

   Nothing is persisted: reloading the page clears it. The original text is
   held in memory and put back verbatim on the way out, so this never damages
   a page even if the words were rewritten mid-game.

   This file is deliberately pure ASCII. It is served without a charset, so a
   stray accented character gets decoded as Latin-1 and turns any regex that
   contains one into a syntax error.
   =========================================================================== */
(function () {
  'use strict';

  var WORD = 'noobular';
  var DELAY = 5000;                 // the fuse, in ms -- on the way IN only

  var originals = null;             // Map<textNode, old text> while ON, null while OFF
  var pending = null;               // timer id while the fuse is burning
  var typed = '';                   // rolling buffer of the last few keystrokes

  /* A "word" for our purposes: a run of letters/digits, optionally carrying
     internal apostrophes or hyphens, so "america's game" and "noodle-based"
     each collapse to one noobular rather than two or three. Punctuation and
     whitespace stay exactly where they were. */
  var RUN = /[0-9A-Za-z]+(?:['-][0-9A-Za-z]+)*/g;
  var HAS_WORD = /[0-9A-Za-z]/;     // non-global, so .test() is not stateful

  /* Never touch text inside these -- rewriting a <script> body, or a textarea
     someone is typing into, would actually break something. */
  var OFF_LIMITS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1 };

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

  function noobulate() {
    originals = new Map();
    var nodes = textNodes();
    for (var i = 0; i < nodes.length; i++) {
      originals.set(nodes[i], nodes[i].nodeValue);
      nodes[i].nodeValue = nodes[i].nodeValue.replace(RUN, cased);
    }
  }

  function restore() {
    /* Nodes detached since the swap (the word game rebuilds its result line on
       every guess) are written back harmlessly and then garbage collected. */
    originals.forEach(function (text, node) { node.nodeValue = text; });
    originals = null;
  }

  function fire() {
    pending = null;
    noobulate();
  }

  function arm() {
    /* Going back is immediate: once the page is nothing but noobular there is
       no joke left in making someone wait to read it again. */
    if (originals) {
      if (pending) { clearTimeout(pending); pending = null; }
      restore();
      return;
    }
    if (pending) return;            // fuse already lit -- don't stack timers
    pending = setTimeout(fire, DELAY);
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
}());
