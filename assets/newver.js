/* ==========================================================================
   newver.js — Noobular full-window landing page engine
   --------------------------------------------------------------------------
   Responsibilities:
     1. Background tiler  — fills the whole viewport with a deterministic
        random selection of images from a pool (pool is date-aware, but for
        now every day resolves to the same default pool).
     2. Region framework  — scatters custom regions/buttons across the page
        deterministically (fixed seed), scaling them to the viewport and
        avoiding overlaps as best it can. Add regions IN CODE at any time
        via REGIONS[] or addRegion(); they redistribute automatically.

   Everything "random" runs through a seeded PRNG so the layout is identical
   on every visit at a given viewport size.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* CONFIG — tweak these freely                                         */
  /* ------------------------------------------------------------------ */
  var CONFIG = {
    SEED: 20260807,        // fixed seed → same layout every visit
    CELL_SIZE: 460,        // target background tile size in px (bigger = fewer, larger images)
    REGION_PADDING: 24,    // min gap (px) enforced between placed regions
    PLACEMENT_TRIES: 120,  // candidate positions tried per region before fallback
    // Region auto-scaling: scale = clamp(min(vw,vh) / SCALE_BASIS, MIN, MAX)
    SCALE_BASIS: 900,
    SCALE_MIN: 0.55,
    SCALE_MAX: 1.15,
    // Fraction of the viewport (centered) reserved for the NOOBULAR header,
    // so regions don't land on top of it.
    CENTER_RESERVE_W: 0.55,
    CENTER_RESERVE_H: 0.32
  };

  /* ------------------------------------------------------------------ */
  /* IMAGE POOLS — date-aware framework                                  */
  /* ------------------------------------------------------------------ */
  // Only the larger content images/gifs currently used in index.html.
  var IMAGE_POOLS = {
    default: [
      'assets/gifs/halloween/rocket.gif',
      'assets/gifs/halloween/fallfinn.gif',
      'assets/gifs/christmas/newyear2010.gif',
      'assets/gifs/yoda ballin.gif',
      'assets/gifs/microcenter.gif',
      'assets/images/chairthatbreaksintoamillionpieces.jpg',
      'assets/images/bush.png',
      'assets/images/bob_dole.png',
      'assets/images/dole2.png',
      'assets/images/romney.png',
      'assets/images/regg.png'
    ]
    // Framework ready for seasonal pools, e.g.:
    // halloween: [ ...october images... ],
    // christmas: [ ...december images... ]
  };

  /**
   * Pick the image pool for a given date. Framework hook: today every date
   * resolves to `default`. Wire seasonal months here later.
   * @param {Date} date
   * @returns {string[]}
   */
  function getPoolForDate(date) {
    // var month = date.getMonth(); // 0 = Jan ... 11 = Dec
    // if (month === 9  && IMAGE_POOLS.halloween) return IMAGE_POOLS.halloween; // Oct
    // if (month === 11 && IMAGE_POOLS.christmas) return IMAGE_POOLS.christmas; // Dec
    return IMAGE_POOLS.default;
  }

  /* ------------------------------------------------------------------ */
  /* REGIONS — define custom scattered content here (in code)            */
  /* ------------------------------------------------------------------ */
  // Each region: { id, html, baseW, baseH }
  //   html  — inner markup (a button, a div, anything)
  //   baseW/baseH — unscaled size in px (auto-scaled to the viewport)
  //
  // For a CUSTOM UPLOADED BUTTON IMAGE, skip `html` and use instead:
  //   { id, baseW, baseH, img:'assets/images/your.png', href:'/target.html', label:'alt text' }
  //
  // Buttons ported from index.html. Add/remove freely — they auto-scatter.
  var REGIONS = [
    {
      id: 'slop', baseW: 260, baseH: 150,
      html: '<button class="region-btn" style="background:peru;color:#fff" ' +
            'onclick="window.location.href=\'/slop.html\'">CLICK TO ENTER SLOPOPOLIS!!!</button>'
    },
    {
      id: 'appeal', baseW: 260, baseH: 150,
      html: '<button class="region-btn" style="background:palevioletred;color:#fff" ' +
            'onclick="window.location.href=\'/appeal.html\'">press here for ban appeals! (or call 1-800-NOOBNET)!</button>'
    },
    {
      id: 'movies', baseW: 240, baseH: 150,
      html: '<button class="region-btn no-pixel" style="background:teal;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px" ' +
            'onclick="window.location.href=\'/themovies.html\'"><span class="pixel-text">GO TO: THE</span><img src="assets/gifs/movies.gif" style="max-height:78%;max-width:100%;width:auto;display:block"></button>'
    },
    {
      id: 'guestbook-2024', baseW: 280, baseH: 150,
      html: '<button class="region-btn" style="background:mediumpurple;color:#000" ' +
            'onclick="window.location.href=\'http://www.websitegoodies.com/guestbook.php?a=view&id=1741018\'">go to the working as of 2024 noobular guestbook</button>'
    },
    {
      id: 'christmas', baseW: 280, baseH: 150,
      html: '<button class="region-btn" style="background:orange;color:#000" ' +
            'onclick="showJollyWarning()">go to the website\'s old christmas 2024 edition! (very cool)</button>'
    },
    {
      id: 'hoa', baseW: 250, baseH: 130,
      html: '<button class="region-btn" style="background:tomato;color:#000" ' +
            'onclick="window.location.href=\'/hoa.html\'">go to the homeowners association...</button>'
    },
    {
      id: 'store', baseW: 220, baseH: 120,
      html: '<button class="region-btn" style="background:purple;color:#fff" ' +
            'onclick="window.location.href=\'/store.html\'">go shopping</button>'
    },
    {
      id: 'news', baseW: 250, baseH: 130,
      html: '<button class="region-btn" style="background:rgb(173,67,67);color:#fff" ' +
            'onclick="window.location.href=\'/NEWS.html\'">(BREAKING!) noobular news network!</button>'
    },
    {
      id: 'dole', baseW: 290, baseH: 160,
      html: '<button class="region-btn" style="background:red;color:#fff" ' +
            'onclick="window.location.href=\'https://www.dolekemp96.org/main.htm\'">Make sure to vote Dole for Mayor of the Survival Multiplayer Minecraft Server!</button>'
    },
    {
      id: 'carney', baseW: 250, baseH: 130,
      html: '<button class="region-btn" style="background:pink;color:#000" ' +
            'onclick="dodgeCarney(this)">carney hospital invitation</button>'
    },
    {
      id: 'donate', baseW: 240, baseH: 120,
      html: '<button class="region-btn" style="background:green;color:#fff" ' +
            'onclick="window.location.href=\'/donate.html\'">DONATE UR JOLLARS</button>'
    },
    {
      id: 'finn', baseW: 230, baseH: 120,
      html: '<button class="region-btn" style="background:yellow;color:#000" ' +
            'onclick="window.location.href=\'/finn.html\'">Finns old website (:</button>'
    },
    {
      id: 'chair', baseW: 210, baseH: 210,
      html: '<img class="chair-img" src="assets/images/chairthatbreaksintoamillionpieces.jpg" ' +
            'title="yesss yesssssss" alt="the chair that breaks into a million pieces" ' +
            'onclick="shatterChair(this)" ' +
            'style="width:100%;height:100%;object-fit:cover;cursor:pointer;display:block;' +
            'border:3px solid #000;box-shadow:0 6px 14px rgba(0,0,0,0.5)">'
    },
    {
      id: 'noobgpt', baseW: 240, baseH: 120,
      html: '<button class="region-btn no-pixel" style="padding:0;overflow:hidden;background:#fff" ' +
            'onclick="window.location.href=\'/noobgpt.html\'"><img src="assets/images/noobgpt.png" style="width:100%;height:100%;object-fit:contain;display:block"></button>'
    },
    {
      id: 'wiki', baseW: 260, baseH: 130,
      html: '<button class="region-btn" style="background:lightskyblue;color:darkorange" ' +
            'onclick="window.location.href=\'/wiki.html\'">the wiki info page with all the information</button>'
    },
    {
      id: 'report', baseW: 250, baseH: 130,
      html: '<button class="region-btn" style="background:lime;color:beige" ' +
            'onclick="window.location.href=\'/report.html\'">reports page (BAN USERS HERE)</button>'
    },
    {
      id: 'modpacks', baseW: 260, baseH: 130,
      html: '<button class="region-btn" style="background:magenta;color:beige" ' +
            'onclick="window.location.href=\'https://modrinth.com/organization/swamptown\'">Noobular Monkey business (modpacks)</button>'
    },
    {
      id: 'guestbook-broken', baseW: 250, baseH: 120,
      html: '<button class="region-btn" style="background:mediumslateblue;color:#fff" ' +
            'onclick="window.location.href=\'/guestbook.html\'">go to the broken guestbook</button>'
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Seeded PRNG (mulberry32) — deterministic randomness                 */
  /* ------------------------------------------------------------------ */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ */
  /* Background tiler                                                     */
  /* ------------------------------------------------------------------ */
  function buildBackground() {
    var bg = document.getElementById('bg');
    if (!bg) return;

    var pool = getPoolForDate(new Date());
    if (!pool || !pool.length) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var cols = Math.max(1, Math.ceil(vw / CONFIG.CELL_SIZE));
    var rows = Math.max(1, Math.ceil(vh / CONFIG.CELL_SIZE));
    var count = cols * rows;

    // Deterministic per-tile image selection. Seed offset keeps it distinct
    // from region placement while staying reproducible.
    var rand = mulberry32(CONFIG.SEED ^ 0x9E3779B9);

    bg.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    bg.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)';

    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var img = document.createElement('img');
      img.className = 'bg-tile';
      img.src = pool[Math.floor(rand() * pool.length)];
      img.alt = '';
      img.loading = 'lazy';
      frag.appendChild(img);
    }

    bg.textContent = '';
    bg.appendChild(frag);
  }

  /* ------------------------------------------------------------------ */
  /* Region layout — deterministic, non-overlapping scatter              */
  /* ------------------------------------------------------------------ */
  function rectsOverlap(a, b, pad) {
    return !(
      a.x + a.w + pad <= b.x ||
      b.x + b.w + pad <= a.x ||
      a.y + a.h + pad <= b.y ||
      b.y + b.h + pad <= a.y
    );
  }

  // How much two rects overlap (area) — used to pick the least-bad fallback.
  function overlapArea(a, b) {
    var ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    var oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return ox * oy;
  }

  function currentScale() {
    var m = Math.min(window.innerWidth, window.innerHeight);
    var s = m / CONFIG.SCALE_BASIS;
    return Math.max(CONFIG.SCALE_MIN, Math.min(CONFIG.SCALE_MAX, s));
  }

  function layoutRegions() {
    var layer = document.getElementById('regions');
    if (!layer) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scale = currentScale();
    var pad = CONFIG.REGION_PADDING;

    // Reserved center rectangle (NOOBULAR header) — treated as an obstacle.
    var reserve = {
      w: vw * CONFIG.CENTER_RESERVE_W,
      h: vh * CONFIG.CENTER_RESERVE_H
    };
    reserve.x = (vw - reserve.w) / 2;
    reserve.y = (vh - reserve.h) / 2;

    // Fresh deterministic RNG each layout → identical placement per size.
    var rand = mulberry32(CONFIG.SEED);

    var placed = [reserve];   // obstacles to avoid (center counts)
    layer.textContent = '';

    for (var i = 0; i < REGIONS.length; i++) {
      var def = REGIONS[i];
      var w = (def.baseW || 200) * scale;
      var h = (def.baseH || 120) * scale;

      // Keep fully on-screen with a small margin.
      var margin = 8;
      var maxX = Math.max(margin, vw - w - margin);
      var maxY = Math.max(margin, vh - h - margin);

      var best = null;
      var bestScore = Infinity;

      for (var t = 0; t < CONFIG.PLACEMENT_TRIES; t++) {
        var cand = {
          x: margin + rand() * (maxX - margin),
          y: margin + rand() * (maxY - margin),
          w: w, h: h
        };

        var clean = true;
        var score = 0;
        for (var p = 0; p < placed.length; p++) {
          if (rectsOverlap(cand, placed[p], pad)) {
            clean = false;
            score += overlapArea(cand, placed[p]);
          }
        }

        if (clean) { best = cand; break; }        // perfect spot found
        if (score < bestScore) {                   // remember least-bad
          bestScore = score;
          best = cand;
        }
      }

      placed.push(best);
      renderRegion(layer, def, best, scale);
    }
  }

  function renderRegion(layer, def, rect, scale) {
    var el = document.createElement('div');
    el.className = 'region';
    if (def.id) el.dataset.regionId = def.id;
    // Position by center so the CSS translate(-50%,-50%) + scale is stable.
    el.style.left = (rect.x + rect.w / 2) + 'px';
    el.style.top = (rect.y + rect.h / 2) + 'px';
    el.style.width = def.baseW + 'px';
    el.style.height = def.baseH + 'px';
    el.style.setProperty('--region-scale', scale);

    if (def.img) {
      // Custom uploaded button image.
      var btn = document.createElement('button');
      btn.className = 'region-btn region-btn--img';
      btn.style.backgroundImage = 'url("' + def.img + '")';
      btn.setAttribute('aria-label', def.label || def.id || 'button');
      if (def.href) {
        btn.addEventListener('click', function () {
          window.location.href = def.href;
        });
      }
      el.appendChild(btn);
    } else {
      el.innerHTML = def.html || '';
    }

    layer.appendChild(el);
  }

  /* ------------------------------------------------------------------ */
  /* Carney hospital — dodge on click (ported from index.html)           */
  /* ------------------------------------------------------------------ */
  function dodgeCarney(btn) {
    var region = btn;
    while (region && !(region.classList && region.classList.contains('region'))) {
      region = region.parentElement;
    }
    if (!region) return;
    if (region.dataset.dodging === '1') return;

    var scale = currentScale();
    var first = region.getBoundingClientRect();
    var w = first.width;
    var h = first.height;
    var margin = 10;

    // Pick a new random center somewhere on screen.
    var minCX = w / 2 + margin;
    var maxCX = window.innerWidth - w / 2 - margin;
    var minCY = h / 2 + margin;
    var maxCY = window.innerHeight - h / 2 - margin;
    var ncx = minCX + Math.random() * Math.max(0, maxCX - minCX);
    var ncy = minCY + Math.random() * Math.max(0, maxCY - minCY);

    region.style.left = ncx + 'px';
    region.style.top = ncy + 'px';

    var last = region.getBoundingClientRect();
    var dx = first.left - last.left;
    var dy = first.top - last.top;

    // Shake + FLIP into place, preserving the centering translate + scale.
    var steps = 28;
    var frames = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      var lx = dx * (1 - ease);
      var ly = dy * (1 - ease);
      var decay = 1 - t;
      var shakeX = (Math.random() * 2 - 1) * 22 * decay;
      var shakeY = (Math.random() * 2 - 1) * 22 * decay;
      var rot = (Math.random() * 2 - 1) * 16 * decay;
      frames.push({
        transform: 'translate(calc(-50% + ' + (lx + shakeX) + 'px), calc(-50% + ' +
          (ly + shakeY) + 'px)) rotate(' + rot + 'deg) scale(' + scale + ')'
      });
    }

    region.dataset.dodging = '1';
    var anim = region.animate(frames, { duration: 420, easing: 'linear' });
    anim.onfinish = function () {
      region.style.transform = '';
      region.dataset.dodging = '0';
    };
  }

  /* ------------------------------------------------------------------ */
  /* The chair that breaks into a million pieces (ported from index.html) */
  /* ------------------------------------------------------------------ */
  function shatterChair(chair) {
    if (!chair || chair.dataset.shattering === '1') return;
    chair.dataset.shattering = '1';

    var COLS = 20;
    var ROWS = 20;
    var FUSE = 1000;
    var MAX_LIFE = 2600;

    var crash = new Audio('assets/sounds/glass breaking.m4a');
    crash.preload = 'auto';
    crash.load();

    setTimeout(function () {
      var rect = chair.getBoundingClientRect();
      var pieceW = rect.width / COLS;
      var pieceH = rect.height / ROWS;

      var shards = document.createElement('div');
      shards.id = 'chair-shards';
      shards.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9997;';
      document.body.appendChild(shards);

      try {
        crash.currentTime = 0;
        crash.play();
      } catch (e) {}

      chair.style.visibility = 'hidden';

      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var piece = document.createElement('div');
          piece.style.cssText =
            'position:absolute;' +
            'left:' + (rect.left + c * pieceW) + 'px;' +
            'top:' + (rect.top + r * pieceH) + 'px;' +
            'width:' + pieceW + 'px;height:' + pieceH + 'px;' +
            'background-image:url("' + chair.src + '");' +
            'background-size:' + rect.width + 'px ' + rect.height + 'px;' +
            'background-position:' + (-c * pieceW) + 'px ' + (-r * pieceH) + 'px;';
          shards.appendChild(piece);

          var outX = ((c + 0.5) / COLS - 0.5) * (260 + Math.random() * 340);
          var outY = ((r + 0.5) / ROWS - 0.5) * 160 - 120 - Math.random() * 120;
          var spin = Math.random() * 1440 - 720;

          piece.animate([
            { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
            { transform: 'translate(' + outX + 'px, ' + outY + 'px) rotate(' + (spin / 3) + 'deg)', opacity: 1, offset: 0.28 },
            { transform: 'translate(' + (outX * 1.5) + 'px, ' + (window.innerHeight + 200) + 'px) rotate(' + spin + 'deg)', opacity: 0 }
          ], {
            duration: 1500 + Math.random() * 900,
            easing: 'cubic-bezier(0.15, 0.55, 0.45, 1)',
            fill: 'forwards'
          });
        }
      }

      setTimeout(function () {
        shards.remove();
      }, MAX_LIFE);
    }, FUSE);
  }

  /* ------------------------------------------------------------------ */
  /* Jolly warning / grinch button (ported from index.html)              */
  /* ------------------------------------------------------------------ */
  function showJollyWarning() {
    var popup = document.getElementById('warning-popup');
    if (popup) popup.style.display = 'flex';
  }

  function hideJollyWarning() {
    var popup = document.getElementById('warning-popup');
    if (popup) popup.style.display = 'none';
  }

  function regg() {
    if (window.noobDownloadRegg) {
      window.noobDownloadRegg();
    } else {
      var link = document.createElement('a');
      link.href = 'assets/images/regg.png';
      link.download = 'regg.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    hideJollyWarning();
  }

  function proceedToChristmas() {
    window.location.href = '/oldchristmasmainpage.html';
  }

  /* ------------------------------------------------------------------ */
  /* Sign in / account system (ported from index.html)                   */
  /* ------------------------------------------------------------------ */
  function showSignIn() {
    var popup = document.getElementById('signin-popup');
    var currentUser = localStorage.getItem('current-user');
    var signinForm = document.getElementById('signin-form');
    var signoutForm = document.getElementById('signout-form');
    var title = document.getElementById('signin-title');
    var usernameDisplay = document.getElementById('current-username-display');

    if (currentUser) {
      signinForm.style.display = 'none';
      signoutForm.style.display = 'block';
      title.textContent = 'ACCOUNT';
      usernameDisplay.textContent = currentUser;
    } else {
      signinForm.style.display = 'block';
      signoutForm.style.display = 'none';
      title.textContent = 'SIGN IN';
    }

    if (popup) popup.style.display = 'flex';
  }

  function hideSignIn() {
    var popup = document.getElementById('signin-popup');
    if (popup) popup.style.display = 'none';
  }

  function updateSignInButton() {
    var currentUser = localStorage.getItem('current-user');
    var button = document.getElementById('signin-button');
    if (button && currentUser) {
      button.textContent = currentUser;
    }
  }

  function signOut() {
    localStorage.removeItem('current-user');
    var button = document.getElementById('signin-button');
    if (button) button.textContent = 'SIGN IN';
    hideSignIn();
  }

  function signIn() {
    var username = document.getElementById('username-input').value;
    var password = document.getElementById('password-input').value;
    var status = document.getElementById('signin-status');

    if (!username || !password) {
      status.textContent = 'Please enter username and password!';
      return;
    }

    var accounts = JSON.parse(localStorage.getItem('noobular-accounts') || '{}');
    if (!accounts['ricky']) {
      accounts['ricky'] = 'ricky';
      localStorage.setItem('noobular-accounts', JSON.stringify(accounts));
    }

    if (accounts[username] && accounts[username] === password) {
      status.textContent = 'Welcome back, ' + username + '!';
      localStorage.setItem('current-user', username);
      updateSignInButton();
      setTimeout(function () {
        hideSignIn();
        status.textContent = '';
        document.getElementById('username-input').value = '';
        document.getElementById('password-input').value = '';
      }, 1500);
    } else {
      status.textContent = 'Invalid username or password!';
    }
  }

  function createAccount() {
    var username = document.getElementById('username-input').value;
    var password = document.getElementById('password-input').value;
    var status = document.getElementById('signin-status');

    if (!username || !password) {
      status.textContent = 'Please enter username and password!';
      return;
    }

    if (!window.usernameAttempts) {
      window.usernameAttempts = 0;
    }

    var hasMinLength = username.length >= 12;
    var hasMaxLength = username.length < 13;
    var hasNumber = /\d/.test(username);
    var hasCapital = /[A-Z]/.test(username);
    var hasSpecial = /[!@#$%^&*()q,.?":{}|<>]/.test(username);
    var hasNoobular = username.includes('I<3NOOBULAR');

    var allValid = hasMinLength && hasNumber && hasCapital && hasSpecial && hasNoobular && hasMaxLength;

    if (!allValid) {
      if (!hasMinLength) {
        if (window.usernameAttempts >= 0) status.textContent = 'Username must be at least 12 character(s)';
        window.usernameAttempts++;
        return;
      }
      if (!hasNumber) {
        if (window.usernameAttempts >= 1) status.textContent = 'Username must contain a(n) number(s)';
        window.usernameAttempts++;
        return;
      }
      if (!hasCapital) {
        if (window.usernameAttempts >= 2) status.textContent = 'Usernames must contain a(n) capital letter(s)';
        window.usernameAttempts++;
        return;
      }
      if (!hasSpecial) {
        if (window.usernameAttempts >= 3) status.textContent = 'Username must contain a(n) special character(s)';
        window.usernameAttempts++;
        return;
      }
      if (!hasNoobular) {
        if (window.usernameAttempts >= 4) status.textContent = 'Username must contain(s) I<3NOOBULAR';
        window.usernameAttempts++;
        return;
      }
      if (!hasMaxLength) {
        if (window.usernameAttempts >= 5) status.textContent = 'Username must be less than 13 character(s)';
        window.usernameAttempts++;
        return;
      }
    }

    window.usernameAttempts++;

    var accounts = JSON.parse(localStorage.getItem('noobular-accounts') || '{}');

    if (accounts[username]) {
      status.textContent = 'Username already exists!';
      return;
    }

    accounts[username] = password;
    localStorage.setItem('noobular-accounts', JSON.stringify(accounts));
    localStorage.setItem('current-user', username);
    window.usernameAttempts = 0;
    updateSignInButton();

    status.textContent = 'Account created! Welcome, ' + username + '!';
    setTimeout(function () {
      hideSignIn();
      status.textContent = '';
      document.getElementById('username-input').value = '';
      document.getElementById('password-input').value = '';
    }, 1500);
  }

  /* ------------------------------------------------------------------ */
  /* Misc interactions: textbox redirect, keyboard shortcuts, trial      */
  /* ------------------------------------------------------------------ */
  function setupInteractions() {
    // Official Noobular Text Box → cinema redirect.
    (function () {
      var targetPhrase = 'Take Me To The Official Noobular Photos Website, Please!';
      var theInputinator = document.querySelector('#noob-input-container input');
      if (!theInputinator) return;
      function checkRedirect() {
        if (theInputinator.value === targetPhrase) {
          window.location.href = 'https://cinema.noobular.top';
        }
      }
      theInputinator.addEventListener('input', checkRedirect);
      theInputinator.addEventListener('change', checkRedirect);
    })();

    // Keyboard shortcuts: p → cinema, s → splat, g → green, ricky/sorry easter eggs.
    var typedBuffer = '';
    window.addEventListener('keydown', function (event) {
      if (event.defaultPrevented) return;
      var target = event.target;
      var isTypingContext = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (isTypingContext) return;
      if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        var key = String(event.key || '').toLowerCase();
        if (key === 'p') {
          window.location.href = 'https://cinema.noobular.top';
        }
        if (key === 's') {
          var splat = document.getElementById('splat-audio');
          if (splat && typeof splat.play === 'function') {
            try { splat.currentTime = 0; splat.play(); } catch (e) {}
          }
        }
        if (key === 'g') {
          var green = document.getElementById('green-audio');
          if (green && typeof green.play === 'function') {
            try { green.currentTime = 0; green.play(); } catch (e) {}
          }
        }
        if (key.length === 1 && key >= 'a' && key <= 'z') {
          typedBuffer += key;
          if (typedBuffer.length > 16) typedBuffer = typedBuffer.slice(-16);
          if (typedBuffer.endsWith('ricky')) {
            try { localStorage.setItem('REMOVE-EVERYTHING', '1'); } catch (e) {}
            document.documentElement.classList.add('REMOVE-EVERYTHING');
            if (document.body) document.body.classList.add('REMOVE-EVERYTHING');
          } else if (typedBuffer.endsWith('sorry')) {
            try { localStorage.removeItem('REMOVE-EVERYTHING'); } catch (e) {}
            document.documentElement.classList.remove('REMOVE-EVERYTHING');
            if (document.body) document.body.classList.remove('REMOVE-EVERYTHING');
          }
        }
      }
    });

    // Free trial nag.
    updateSignInButton();
    setInterval(function () {
      var currentUser = localStorage.getItem('current-user');
      if (!currentUser) {
        alert('FREE TRIAL EXPIRED! Sign in to continue.');
      }
    }, 10000);
  }

  // Expose functions used by inline onclick handlers.
  window.dodgeCarney = dodgeCarney;
  window.shatterChair = shatterChair;
  window.showJollyWarning = showJollyWarning;
  window.hideJollyWarning = hideJollyWarning;
  window.regg = regg;
  window.proceedToChristmas = proceedToChristmas;
  window.showSignIn = showSignIn;
  window.hideSignIn = hideSignIn;
  window.signIn = signIn;
  window.createAccount = createAccount;
  window.signOut = signOut;
  window.updateSignInButton = updateSignInButton;

  /* ------------------------------------------------------------------ */
  /* Public (code-level) API — extensibility, not a visitor feature      */
  /* ------------------------------------------------------------------ */
  /**
   * Add a region in code and redistribute. Example:
   *   addRegion({ id:'x', baseW:200, baseH:100,
   *               html:'<button class="region-btn">X</button>' });
   */
  function addRegion(def) {
    if (!def) return;
    REGIONS.push(def);
    layoutRegions();
  }

  window.NoobularPage = {
    addRegion: addRegion,
    relayout: layoutRegions,
    rebuildBackground: buildBackground,
    REGIONS: REGIONS,
    CONFIG: CONFIG,
    IMAGE_POOLS: IMAGE_POOLS
  };
  // Convenience alias.
  window.addRegion = addRegion;

  /* ------------------------------------------------------------------ */
  /* Init + responsive re-layout (rAF-debounced)                         */
  /* ------------------------------------------------------------------ */
  function renderAll() {
    buildBackground();
    layoutRegions();
  }

  var resizeScheduled = false;
  function onResize() {
    if (resizeScheduled) return;
    resizeScheduled = true;
    window.requestAnimationFrame(function () {
      resizeScheduled = false;
      renderAll();
    });
  }

  function init() {
    renderAll();
    setupInteractions();
    window.addEventListener('resize', onResize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
