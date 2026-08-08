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
    BG_MOSAIC: false,      // false = plain background, true = random image mosaic
    CELL_SIZE: 150,        // background mosaic tile size in px (smaller = more, tinier images)
    REGION_PADDING: 24,    // min gap (px) enforced between placed regions
    PLACEMENT_TRIES: 250,  // candidate positions tried per region before fallback
    SETTLE_STEP: 3,        // px per nudge when pulling regions in toward the center
    SETTLE_PASSES: 8,      // repeat sweeps, so freed-up space lets neighbours close in
    SHRINK_STEPS: 6,       // extra shrink-and-retry passes if nothing fits cleanly
    SHRINK_FACTOR: 0.88,   // size multiplier applied per shrink step
    // Region auto-scaling: scale = clamp(min(vw,vh) / SCALE_BASIS, MIN, MAX)
    SCALE_BASIS: 900,
    SCALE_MIN: 0.55,
    SCALE_MAX: 1.15,
    // Breathing room (px) left around the NOOBULAR logo. The reserved area is
    // measured from the logo itself, so this is literally the gap between the
    // logo edge and the nearest button — turn it down to tighten the cluster.
    CENTER_GAP: 18,
    // Button labels are auto-sized to fill their button without overflowing.
    BTN_FONT_MIN: 9,
    BTN_FONT_MAX: 42,
    // Birds fly across the screen on their own this often (also bound to "b").
    BIRDS_MIN_MS: 60000,
    BIRDS_MAX_MS: 120000,
    // Fallback only, used if the logo hasn't loaded and can't be measured yet.
    // Fraction of the viewport (centered) reserved for the NOOBULAR header.
    CENTER_RESERVE_W: 0.55,
    CENTER_RESERVE_H: 0.32
  };

  /* ------------------------------------------------------------------ */
  /* IMAGE POOLS — date-aware framework                                  */
  /* ------------------------------------------------------------------ */
  // Only the larger content images/gifs currently used in index.html.
  var IMAGE_POOLS = {
    // Every gif + image in assets, except the three anime gifs
    // (zenless-zone-zero, nekomata, cirno-touhou) and the retro banner logos.
    default: [
      // --- gifs ---
      'assets/gifs/banappeals.gif',
      'assets/gifs/bear-jumpscare.gif',
      'assets/gifs/best-friends-bffs.gif',
      'assets/gifs/danger-alert.gif',
      'assets/gifs/gif1.gif',
      'assets/gifs/gif2.gif',
      'assets/gifs/gif3.gif',
      'assets/gifs/gif4.gif',
      'assets/gifs/gif5.gif',
      'assets/gifs/gif6.gif',
      'assets/gifs/gif7.gif',
      'assets/gifs/grr.gif',
      'assets/gifs/hey-buddy-you-have-to-be-quiet.gif',
      'assets/gifs/it-cant-be.gif',
      'assets/gifs/microcenter.gif',
      'assets/gifs/movies.gif',
      'assets/gifs/sadseal.gif',
      'assets/gifs/shoppingcart.gif',
      'assets/gifs/sloppyINTRO2020.gif',
      'assets/gifs/yoda ballin.gif',
      // --- halloween gifs ---
      'assets/gifs/halloween/fallfinn.gif',
      'assets/gifs/halloween/rocket.gif',
      // --- christmas gifs ---
      'assets/gifs/christmas/happy-new-year-2019.gif',
      'assets/gifs/christmas/merrymaxwell.gif',
      'assets/gifs/christmas/merryme.gif',
      'assets/gifs/christmas/newyear2010.gif',
      'assets/gifs/christmas/santa-clause-santa.gif',
      // --- images ---
      'assets/images/2.png',
      'assets/images/bob_dole.png',
      'assets/images/bubby.png',
      'assets/images/bush.png',
      'assets/images/chairthatbreaksintoamillionpieces.jpg',
      'assets/images/christmas-ornament-balls-background-tiled.jpg',
      'assets/images/colt.png',
      'assets/images/dole2.png',
      'assets/images/felipe_trap.png',
      'assets/images/grinchmountain.png',
      'assets/images/hallo.jpg',
      'assets/images/halloween.png',
      'assets/images/hard.png',
      'assets/images/lily-repeller.png',
      'assets/images/lobotomy.png',
      'assets/images/lungcancer.png',
      'assets/images/miles.jpg',
      'assets/images/miyabizzz.png',
      'assets/images/mobfarm.gif',
      'assets/images/mobfarm.png',
      'assets/images/movies.jpg',
      'assets/images/noobgpt.png',
      'assets/images/noobular-vinyl.jpg',
      'assets/images/noogpt.jpg',
      'assets/images/pearson.png',
      'assets/images/realistic-news-studio-background_52683-103246.jpg',
      'assets/images/regg.png',
      'assets/images/romney.png',
      'assets/images/SONIC3THEHEDGEHOG.png',
      'assets/images/store-background-scary.jpg',
      'assets/images/store-background.jpg',
      'assets/images/ticketguy.jpg',
      'assets/gifs/halloween/finn.png'
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
  /* ------------------------------------------------------------------ */
  /* PICTURE FRAMES — the five gifs that used to sit in the homepage row  */
  /* ------------------------------------------------------------------ */
  // Inner opening of each frame png, measured from its alpha channel and
  // pulled in ~10% so the gif tucks under the ornate border instead of
  // risking a hairline gap at the edge.
  var FRAME_STYLES = {
    1: { src: 'assets/images/frame1.png', insets: [12.6, 12.6, 12.4, 12.4] },
    2: { src: 'assets/images/frame2.png', insets: [11.2, 10.8, 10.2, 10.2] },
    3: { src: 'assets/images/frame3.png', insets: [19.8, 27.0, 9.6, 6.6] }
  };

  // Tuned by eye against the button sizes rather than to any particular
  // fraction of the gif.
  var GIF_SCALE = 0.35;

  // The frame WRAPS the gif rather than the gif being fitted into a fixed
  // frame: the gif is drawn at GIF_SCALE and the outer box is grown so that
  // its opening comes out exactly that size. Since the border eats a known
  // fraction of each axis, that's just a division:
  //
  //   openW = W(1 - l - r) = gifW   =>   W = gifW / (1 - l - r)
  //
  // Natural sizes are passed in so this stays a plain static computation and
  // the placer knows every region's real footprint before anything loads.
  function framedRegion(id, style, gif, natW, natH) {
    var f = FRAME_STYLES[style];
    var openW = 1 - (f.insets[0] + f.insets[1]) / 100;
    var openH = 1 - (f.insets[2] + f.insets[3]) / 100;

    return {
      id: id,
      baseW: Math.round(natW * GIF_SCALE / openW),
      baseH: Math.round(natH * GIF_SCALE / openH),
      fixedShape: 'none',
      html: '<div class="framed" ' +
            'style="--in-l:' + f.insets[0] + '%;--in-r:' + f.insets[1] + '%;' +
            '--in-t:' + f.insets[2] + '%;--in-b:' + f.insets[3] + '%">' +
            '<div class="framed-inner">' +
            // the gif lives in a plain div, not positioned directly: an
            // absolutely-positioned <img> with width:auto uses its INTRINSIC
            // size and throws away the right/bottom offsets, so it would
            // render full-size and burst out of the frame
            '<div class="framed-opening">' +
            '<img class="framed-gif" src="' + gif + '" alt="">' +
            '</div>' +
            '<img class="framed-border" src="' + f.src + '" alt="">' +
            '</div></div>'
    };
  }

  // Buttons ported from index.html. Add/remove freely — they auto-scatter.
  var REGIONS = [
    // Portrait gif goes in frame3, whose opening is the tall one.
    framedRegion('frame-rocket',      3, 'assets/gifs/halloween/rocket.gif',        333, 500),
    framedRegion('frame-fallfinn',    2, 'assets/gifs/halloween/fallfinn.gif',      351, 388),
    framedRegion('frame-newyear',     1, 'assets/gifs/christmas/newyear2010.gif',   640, 480),
    framedRegion('frame-yoda',        1, 'assets/gifs/yoda ballin.gif',             500, 487),
    framedRegion('frame-microcenter', 2, 'assets/gifs/microcenter.gif',             500, 375),
    {
      id: 'slop', baseW: 260, baseH: 150,
      html: '<button class="region-btn" style="background:peru;color:#fff" ' +
            'onclick="window.location.href=\'/slop.html\'">CLICK TO ENTER SLOPOPOLIS!!!</button>'
    },
    {
      id: 'appeal', baseW: 260, baseH: 175,
      html: '<button class="region-btn no-pixel" style="background:palevioletred;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px" ' +
            'onclick="window.location.href=\'/appeal.html\'"><img src="assets/gifs/banappeals.gif" style="max-height:100%;max-width:100%;width:auto;display:block"></button>'
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
      id: 'halloween2025', baseW: 280, baseH: 150,
      html: '<button class="region-btn" style="background:orange;color:#000" ' +
            'onclick="window.location.href=\'/halloween2025.html\'">go to the HALLOWEEN 2025 version! (very spooky)</button>'
    },
    {
      // "go to the [hoa gif]"
      id: 'hoa', baseW: 220, baseH: 180,
      html: '<button class="region-btn no-pixel" style="background:tomato;color:#000;' +
            'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:20px" ' +
            'onclick="window.location.href=\'/hoa.html\'">' +
            '<span class="pixel-text">go to the</span>' +
            '<img src="assets/gifs/hoa.gif" style="max-height:72%;max-width:100%;width:auto;display:block">' +
            '</button>'
    },
    {
      // Square region + fixedShape:'circle' — 50% radius on a non-square box
      // would give an ellipse. 15% padding keeps the cart inside the circle's
      // inscribed square (~70.7% of the diameter) instead of clipping corners.
      id: 'store', baseW: 160, baseH: 160, fixedShape: 'circle',
      html: '<button class="region-btn no-pixel" style="background:purple;display:flex;align-items:center;justify-content:center;padding:15%" ' +
            'onclick="window.location.href=\'/store.html\'"><img src="assets/gifs/shoppingcart.gif" style="max-height:100%;max-width:100%;width:auto;display:block"></button>'
    },
    {
      // "(BREAKING!) [news gif] NETWORK!"
      id: 'news', baseW: 240, baseH: 210,
      html: '<button class="region-btn no-pixel" style="background:rgb(173,67,67);color:#fff;' +
            'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:20px" ' +
            'onclick="window.location.href=\'/NEWS.html\'">' +
            '<span class="pixel-text">(BREAKING!)</span>' +
            '<img src="assets/gifs/news.gif" style="max-height:58%;max-width:100%;width:auto;display:block">' +
            '<span class="pixel-text">NETWORK!</span>' +
            '</button>'
    },
    {
      // SMP "days since last update" counter — a plain section, not a button.
      id: 'smp', baseW: 200, baseH: 260, fixedShape: 'none',
      html: '<div style="width:100%;height:100%;background:#FFA500;border:6px solid #000;' +
            'box-shadow:inset 0 0 0 3px #FFD700,0 6px 12px rgba(0,0,0,0.5);text-align:center;padding:10px;' +
            'box-sizing:border-box;font-family:\'Arial Black\',\'Impact\',sans-serif;position:relative;' +
            'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">' +
            '<div style="background:#000;color:#FFD700;padding:4px 4px;border:2px solid #FFD700;' +
            'text-transform:uppercase;font-size:clamp(9px,1.9vh,16px);font-weight:bold;letter-spacing:1px">DAYS SINCE LAST</div>' +
            '<div style="background:#000;color:#FFD700;padding:4px 4px;border:2px solid #FFD700;' +
            'text-transform:uppercase;font-size:clamp(10px,2.2vh,19px);font-weight:bold;letter-spacing:1px">SMP UPDATE</div>' +
            '<div class="smp-days" style="display:flex;justify-content:center;flex-wrap:wrap;gap:4px;margin:4px auto"></div>' +
            '<div style="font-size:clamp(7px,1.2vh,10px);color:#000;font-weight:bold;text-transform:uppercase">' +
            'if it ain\'t broke, don\'t fix it</div></div>'
    },
    {
      // Free-floating text, no box — still placed, so it stays off the buttons.
      id: 'mikey', baseW: 250, baseH: 130, fixedShape: 'none',
      html: '<div class="free-text" style="color:mediumpurple">' +
            'mikey geiger counter reading: OFF THE CHARTS!</div>'
    },
    {
      // The celebration line that used to sit beside the counter in the header.
      id: 'visits-text', baseW: 260, baseH: 120, fixedShape: 'none',
      html: '<div class="free-text" style="color:#FFE400">' +
            '🎉🎉🎉 now celebraing OVER 8.1 BILLION VISITS 🎉🎉🎉</div>'
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
      // 260x212 matches the source image's 735x598, and fixedShape:'none' keeps
      // it out of the random clip-path/border-radius pool — so it stays a plain
      // rectangle and object-fit:contain never crops it.
      id: 'chair', baseW: 260, baseH: 212, fixedShape: 'none',
      html: '<img class="chair-img" src="assets/images/chairthatbreaksintoamillionpieces.jpg" ' +
            'title="yesss yesssssss" alt="the chair that breaks into a million pieces" ' +
            'onclick="shatterChair(this)" ' +
            'style="width:100%;height:100%;object-fit:contain;cursor:pointer;display:block;' +
            'box-shadow:0 6px 14px rgba(0,0,0,0.5)">'
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
  /* Background mode — plain sky vs the mosaic of gifs ("c" toggles)      */
  /* ------------------------------------------------------------------ */
  var BG_MOSAIC_KEY = 'noobular-bg-mosaic';

  // The cloud tile is a CSS background on #bg, so it has to be switched off
  // or it shows through the gaps between mosaic tiles.
  function applyBgMode() {
    var on = !!CONFIG.BG_MOSAIC;
    var root = document.documentElement;
    if (root.classList.toggle) root.classList.toggle('bg-mosaic', on);
    else if (on) root.className += ' bg-mosaic';
  }

  function loadBgPreference() {
    try {
      var saved = localStorage.getItem(BG_MOSAIC_KEY);
      if (saved !== null) CONFIG.BG_MOSAIC = saved === '1';
    } catch (e) {
    }
    applyBgMode();
  }

  function toggleBgMosaic() {
    CONFIG.BG_MOSAIC = !CONFIG.BG_MOSAIC;
    try {
      localStorage.setItem(BG_MOSAIC_KEY, CONFIG.BG_MOSAIC ? '1' : '0');
    } catch (e) {
    }
    applyBgMode();
    buildBackground();
  }

  /* ------------------------------------------------------------------ */
  /* Background tiler                                                     */
  /* ------------------------------------------------------------------ */
  function buildBackground() {
    var bg = document.getElementById('bg');
    if (!bg) return;

    // Mosaic off: leave #bg empty so the plain page background shows through.
    // Clearing rather than bailing early matters on resize, which re-renders.
    if (!CONFIG.BG_MOSAIC) {
      bg.textContent = '';
      return;
    }

    var pool = getPoolForDate(new Date());
    if (!pool || !pool.length) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var cell = CONFIG.CELL_SIZE;

    // Extra row/col so jittered edge tiles still reach past the viewport edges.
    var cols = Math.max(1, Math.ceil(vw / cell)) + 1;
    var rows = Math.max(1, Math.ceil(vh / cell)) + 1;

    // Deterministic per-tile selection/placement. Seed offset keeps it distinct
    // from region placement while staying reproducible.
    var rand = mulberry32(CONFIG.SEED ^ 0x9E3779B9);

    bg.style.gridTemplateColumns = '';
    bg.style.gridTemplateRows = '';

    var frag = document.createDocumentFragment();
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var img = document.createElement('img');
        img.className = 'bg-tile';
        img.src = pool[Math.floor(rand() * pool.length)];
        img.alt = '';
        img.loading = 'lazy';

        // Splattered mosaic: oversize each tile and jitter/rotate it so the
        // images overlap organically instead of forming a neat grid.
        var size = cell * (1.12 + rand() * 0.28);          // 1.12x .. 1.4x the cell
        var cx = (c - 0.5) * cell + cell / 2 + (rand() * 2 - 1) * cell * 0.18;
        var cy = (r - 0.5) * cell + cell / 2 + (rand() * 2 - 1) * cell * 0.18;
        var rot = (rand() * 2 - 1) * 10;                   // -10deg .. 10deg

        img.style.width = size + 'px';
        img.style.height = size + 'px';
        img.style.left = cx + 'px';
        img.style.top = cy + 'px';
        img.style.transform = 'translate(-50%, -50%) rotate(' + rot + 'deg)';
        img.style.zIndex = Math.floor(rand() * 100);
        frag.appendChild(img);
      }
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

  // Deterministic string hash (FNV-1a) for per-region shape selection.
  function strHash(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Button shapes, chosen deterministically per region from the seed + id.
  // `pad` keeps text away from clipped/curved edges so it doesn't overflow.
  // Padding keeps labels clear of the clipped corners. Trimmed ~25% from the
  // original values — they were conservative enough that the auto-fitted text
  // was coming out smaller than the buttons had room for.
  var SHAPES = [
    { radius: '14px', pad: '6px 10px' },                              // rounded rectangle
    { radius: '999px', pad: '8px 18px' },                             // pill
    { radius: '50%', pad: '12% 15%' },                                // ellipse
    { radius: '45% 12% 45% 12% / 30% 20% 30% 20%', pad: '11% 12%' },  // leaf / blob
    { clip: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)', pad: '8% 17%' }, // hexagon
    { clip: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', pad: '17% 18%' },   // diamond
    { clip: 'polygon(12% 0,100% 0,88% 100%,0 100%)', pad: '8% 14%' }      // parallelogram
  ];

  function applyShape(def, target) {
    if (!target) return;
    // Some regions opt out of random shapes.
    if (def.fixedShape === 'none') return;       // keep the element's own styling
    if (def.fixedShape === 'square') {
      target.style.clipPath = 'none';
      target.style.webkitClipPath = 'none';
      target.style.borderRadius = '10px';
      target.style.padding = '8px';
      return;
    }
    // A true circle only if the region is square — otherwise 50% is an ellipse,
    // so give these regions matching baseW/baseH.
    if (def.fixedShape === 'circle') {
      target.style.clipPath = 'none';
      target.style.webkitClipPath = 'none';
      target.style.borderRadius = '50%';
      return;
    }
    var shapeRand = mulberry32((CONFIG.SEED ^ strHash(def.id || 'region')) >>> 0);
    var shape = SHAPES[Math.floor(shapeRand() * SHAPES.length)];
    if (shape.clip) {
      target.style.borderRadius = '0';
      target.style.clipPath = shape.clip;
      target.style.webkitClipPath = shape.clip;
    } else {
      target.style.borderRadius = shape.radius;
    }
    // Only pad text buttons (not images / gif buttons) to prevent overflow.
    if (shape.pad && target.tagName !== 'IMG' && !target.classList.contains('no-pixel')) {
      target.style.padding = shape.pad;
    }
  }

  // Seeded RNG unique to a region + purpose (salt), so different traits
  // (size, font, shape) vary independently but reproducibly.
  function seededRandFor(def, salt) {
    return mulberry32((CONFIG.SEED ^ strHash((def.id || 'region') + ':' + salt)) >>> 0);
  }

  // Per-region size multiplier applied to every button (0.8x .. 1.35x).
  function sizeMulFor(def) {
    return 0.8 + seededRandFor(def, 'size')() * 0.55;
  }

  // Alternate fonts occasionally used on plain text buttons.
  var ALT_FONTS = [
    "'Comic Sans MS', cursive",
    "'Courier New', monospace",
    'Georgia, serif',
    "'Times New Roman', serif"
  ];

  // Occasionally swap the font family on a plain text button, seeded.
  // (Font SIZE is left to CSS so text doesn't overflow the shapes.)
  function applyFont(def, btn) {
    if (!btn) return;
    if (btn.classList.contains('no-pixel')) return;   // gif/image buttons
    if (btn.querySelector('img')) return;             // has an image
    var r = seededRandFor(def, 'font');
    if (r() < 0.35) {
      btn.style.fontFamily = ALT_FONTS[Math.floor(r() * ALT_FONTS.length)];
    }
  }

  // Highly saturated background/text pairs — no muted/pastel tones, so the
  // randomly picked button colors stay loud and punchy instead of dim.
  var VIVID_COLORS = [
    { bg: '#FF1E1E', fg: '#fff' }, // vivid red
    { bg: '#FF7A00', fg: '#000' }, // vivid orange
    { bg: '#FFE400', fg: '#000' }, // vivid yellow
    { bg: '#39FF14', fg: '#000' }, // vivid green
    { bg: '#00E5FF', fg: '#000' }, // vivid cyan
    { bg: '#1E6BFF', fg: '#fff' }, // vivid blue
    { bg: '#7B2BFF', fg: '#fff' }, // vivid purple
    { bg: '#FF00D6', fg: '#fff' }, // vivid magenta
    { bg: '#FF2E7E', fg: '#fff' }, // vivid pink/red
    { bg: '#00FFA3', fg: '#000' }  // vivid spring green
  ];

  // Seed-determined, highly saturated background color for plain text
  // buttons (skips gif/image buttons, which keep their own art/background).
  function applyColor(def, btn) {
    if (!btn) return;
    if (btn.classList.contains('no-pixel')) return;   // gif/image buttons
    if (btn.querySelector('img')) return;             // has an image
    var r = seededRandFor(def, 'color');
    var pick = VIVID_COLORS[Math.floor(r() * VIVID_COLORS.length)];
    btn.style.backgroundColor = pick.bg;
    btn.style.color = pick.fg;
  }

  // Reserve space at the bottom for the (fixed) cookie banner when present,
  // so scattered buttons don't get hidden underneath it.
  function getBottomReserve() {
    var b = document.getElementById('noob-cookie-banner');
    if (!b) return 0;
    if (b.style.display === 'none' || b.hidden) return 0;
    var h = b.offsetHeight || 0;
    return h ? h + 12 : 0;
  }

  // The retro banner strip is fixed to the top — keep buttons clear of it.
  function getTopReserve() {
    var b = document.getElementById('banners');
    if (!b) return 0;
    if (b.style.display === 'none' || b.hidden) return 0;
    var h = b.offsetHeight || 0;
    return h ? h + 8 : 0;
  }

  // Does rect sit inside bounds and clear of every obstacle except its own?
  function rectIsFree(rect, obstacles, skipIndex, bounds, pad) {
    if (rect.x < bounds.minX || rect.y < bounds.minY) return false;
    if (rect.x + rect.w > bounds.maxX || rect.y + rect.h > bounds.maxY) return false;
    for (var i = 0; i < obstacles.length; i++) {
      if (i === skipIndex || !obstacles[i]) continue;
      if (rectsOverlap(rect, obstacles[i], pad)) return false;
    }
    return true;
  }

  // Walk every region toward the center until something blocks it. If the
  // straight-in step is blocked we retry each axis alone, which lets a region
  // slide around the NOOBULAR reserve instead of stalling against its corner.
  // Repeated passes matter: once one region closes in, the gap it left behind
  // may open a path for another.
  function settleTowardCenter(placed, firstRegion, cx, cy, bounds, pad) {
    var step = CONFIG.SETTLE_STEP;

    for (var pass = 0; pass < CONFIG.SETTLE_PASSES; pass++) {
      var movedAny = false;

      for (var k = firstRegion; k < placed.length; k++) {
        var r = placed[k];
        if (!r) continue;

        for (var guard = 0; guard < 1000; guard++) {
          var dx = cx - (r.x + r.w / 2);
          var dy = cy - (r.y + r.h / 2);
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= step) break;               // already on top of the center

          var sx = dx / dist * step;
          var sy = dy / dist * step;
          var attempts = [[sx, sy], [sx, 0], [0, sy]];

          var advanced = false;
          for (var a = 0; a < attempts.length; a++) {
            var cand = {
              x: r.x + attempts[a][0],
              y: r.y + attempts[a][1],
              w: r.w, h: r.h
            };
            if (rectIsFree(cand, placed, k, bounds, pad)) {
              r.x = cand.x;
              r.y = cand.y;
              advanced = true;
              movedAny = true;
              break;
            }
          }
          if (!advanced) break;                  // wedged in; leave it here
        }
      }

      if (!movedAny) break;                      // nothing shifted, we're settled
    }
  }

  function layoutRegions() {
    var layer = document.getElementById('regions');
    if (!layer) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scale = currentScale();
    var pad = CONFIG.REGION_PADDING;

    // Cookie banner sits fixed at the bottom, banner strip at the top —
    // keep buttons + header clear of both.
    var bottomReserve = getBottomReserve();
    var topReserve = getTopReserve();
    document.documentElement.style.setProperty('--bottom-reserve', bottomReserve + 'px');

    // Reserved center rectangle (NOOBULAR logo) — treated as an obstacle.
    // Measure the logo rather than guessing a viewport fraction: a fraction is
    // both too roomy on wide screens (the logo caps at 640px) and too tight on
    // narrow ones (where the logo grows to 60vw and would poke out of it).
    // Only the SIZE is measured — the position is derived, because #center
    // animates its padding-bottom and a mid-transition read would be wrong.
    var reserve;
    var logo = document.querySelector('.noob-logo');
    var logoRect = logo ? logo.getBoundingClientRect() : null;
    var gap = CONFIG.CENTER_GAP;

    if (logoRect && logoRect.width > 0 && logoRect.height > 0) {
      reserve = { w: logoRect.width + gap * 2, h: logoRect.height + gap * 2 };
    } else {
      reserve = { w: vw * CONFIG.CENTER_RESERVE_W, h: vh * CONFIG.CENTER_RESERVE_H };
    }
    reserve.x = (vw - reserve.w) / 2;
    reserve.y = (vh - bottomReserve - reserve.h) / 2;

    // Everything is pulled toward the middle of the NOOBULAR logo, which
    // #center positions at the midpoint of the space above the cookie banner.
    var cx = vw / 2;
    var cy = (vh - bottomReserve) / 2;
    function centerDist(r) {
      var dx = r.x + r.w / 2 - cx;
      var dy = r.y + r.h / 2 - cy;
      return Math.sqrt(dx * dx + dy * dy);
    }

    var margin = 8;
    var bounds = {
      minX: margin,
      minY: topReserve + margin,
      maxX: vw - margin,
      maxY: vh - bottomReserve - margin
    };

    // Fresh deterministic RNG each layout → identical placement per size.
    var rand = mulberry32(CONFIG.SEED);

    var placed = [reserve];   // obstacles to avoid (center counts)
    var pending = [];         // render after settling, not during placement
    layer.textContent = '';

    // Place the biggest regions first — they're the hardest to fit, so
    // giving them first pick of open space leaves smaller ones more room
    // to slot into the gaps without overlapping.
    var order = REGIONS.slice().sort(function (a, b) {
      return (b.baseW || 200) * (b.baseH || 120) - (a.baseW || 200) * (a.baseH || 120);
    });

    for (var i = 0; i < order.length; i++) {
      var def = order[i];
      var sizeMul = sizeMulFor(def);
      var w = (def.baseW || 200) * scale * sizeMul;
      var h = (def.baseH || 120) * scale * sizeMul;

      var best = null;
      var bestScore = Infinity;
      var bestShrink = 0;

      // Try placing at full size, then progressively shrink (a handful of
      // times) if no clean spot was found — a slightly smaller button that
      // doesn't overlap beats a full-size one stacked on top of another.
      for (var shrink = 0; shrink <= CONFIG.SHRINK_STEPS; shrink++) {
        var curW = w * Math.pow(CONFIG.SHRINK_FACTOR, shrink);
        var curH = h * Math.pow(CONFIG.SHRINK_FACTOR, shrink);

        // Keep fully on-screen with a small margin, below the banner strip
        // and above the cookie banner.
        var minX = bounds.minX;
        var minY = bounds.minY;
        var maxX = Math.max(minX, bounds.maxX - curW);
        var maxY = Math.max(minY, bounds.maxY - curH);

        var roundBest = null;
        var roundScore = Infinity;
        var cleanBest = null;
        var cleanDist = Infinity;

        for (var t = 0; t < CONFIG.PLACEMENT_TRIES; t++) {
          var cand = {
            x: minX + rand() * (maxX - minX),
            y: minY + rand() * (maxY - minY),
            w: curW, h: curH
          };

          var clean = true;
          var score = 0;
          for (var p = 0; p < placed.length; p++) {
            if (rectsOverlap(cand, placed[p], pad)) {
              clean = false;
              score += overlapArea(cand, placed[p]);
            }
          }

          if (clean) {
            // Don't stop at the first opening — keep the one nearest the
            // center, so the settle pass starts from a tight layout.
            var d = centerDist(cand);
            if (d < cleanDist) { cleanDist = d; cleanBest = cand; }
          } else if (score < roundScore) {   // remember least-bad
            roundScore = score;
            roundBest = cand;
          }
        }

        if (cleanBest) { roundBest = cleanBest; roundScore = 0; }

        if (roundScore < bestScore) {
          bestScore = roundScore;
          best = roundBest;
          bestShrink = shrink;
        }
        if (bestScore === 0) break;   // clean spot found, no need to shrink further
      }

      placed.push(best);
      pending.push({
        def: def,
        rect: best,   // same object as in `placed`, so settling updates both
        sizeMul: sizeMul * Math.pow(CONFIG.SHRINK_FACTOR, bestShrink)
      });
    }

    // Pull everything in toward the logo, then draw the settled positions.
    settleTowardCenter(placed, 1, cx, cy, bounds, pad);

    for (var j = 0; j < pending.length; j++) {
      renderRegion(layer, pending[j].def, pending[j].rect, scale, pending[j].sizeMul);
    }

    // After render: the buttons need to be in the DOM at their final size
    // before their labels can be measured and fitted.
    fitAllButtonText(layer);

    populateSmpDays();
  }

  /* ------------------------------------------------------------------ */
  /* Birds flyby                                                         */
  /* ------------------------------------------------------------------ */
  var BIRDS_W = 112, BIRDS_H = 77;   // natural size of birds.gif
  // The birds in the gif face LEFT, so a right-bound flight is mirrored.
  // Flip this if they ever end up flying backwards.
  var BIRDS_FACE_LEFT = true;
  var birdsTimer = null;

  // Preloaded once and cloned per flight, so overlapping flocks each get their
  // own playback without refetching the file.
  var birdsAudio = new Audio('assets/sounds/seagulls.mp3');
  birdsAudio.preload = 'auto';

  function screech() {
    try {
      var a = birdsAudio.cloneNode();
      a.volume = 0.7;
      // Rejects when the flight was fired by the timer rather than a keypress
      // and the user hasn't interacted with the page yet — nothing to do.
      var p = a.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  // dir: 'left' | 'right' | undefined (random)
  function flyBirds(dir) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var w = Math.max(110, Math.min(230, vw * 0.12));
    var h = w * BIRDS_H / BIRDS_W;

    var toRight = dir === 'right' || (dir !== 'left' && Math.random() < 0.5);
    var flip = (toRight === BIRDS_FACE_LEFT) ? ' scaleX(-1)' : '';

    screech();

    var img = document.createElement('img');
    img.className = 'birds-flyby';
    img.src = 'assets/gifs/birds.gif';
    img.alt = '';
    img.style.width = w + 'px';
    img.style.height = h + 'px';
    // Keep them out of the very top and bottom of the window.
    img.style.top = (vh * (0.06 + Math.random() * 0.5)) + 'px';
    img.style.left = '0';
    document.body.appendChild(img);

    var startX = toRight ? -(w + 40) : vw + 40;
    var endX = toRight ? vw + 40 : -(w + 40);
    var drift = (Math.random() * 2 - 1) * vh * 0.08;   // gentle rise or fall

    var anim = img.animate([
      { transform: 'translate(' + startX + 'px, 0)' + flip },
      { transform: 'translate(' + endX + 'px, ' + drift + 'px)' + flip }
    ], {
      duration: 6000 + Math.random() * 5000,
      easing: 'linear',
      fill: 'forwards'
    });

    anim.onfinish = function () { img.remove(); };
    // Backstop: onfinish never lands if the tab is backgrounded mid-flight.
    setTimeout(function () { img.remove(); }, 20000);
  }

  function birdsDelay() {
    var lo = CONFIG.BIRDS_MIN_MS;
    var hi = CONFIG.BIRDS_MAX_MS;
    return lo + Math.random() * Math.max(0, hi - lo);
  }

  // Chained timeouts, not an interval, so the gap is re-rolled every time.
  function scheduleBirds() {
    if (birdsTimer) return;
    birdsTimer = setTimeout(function tick() {
      flyBirds();
      birdsTimer = setTimeout(tick, birdsDelay());
    }, birdsDelay());
  }

  /* ------------------------------------------------------------------ */
  /* Auto-size button labels to their button                             */
  /* ------------------------------------------------------------------ */
  // Binary-searches the largest font size whose wrapped label still fits the
  // button's content box, so short labels grow and long ones shrink instead of
  // being clipped by the button's overflow:hidden.
  function fitButtonText(btn) {
    if (!btn || btn.querySelector('img')) return;   // image buttons have no label

    // Measure a span, not the button: the button is a centering flex container,
    // so content taller than it overflows in both directions and its own
    // scrollHeight under-reports the overflow.
    var label = btn.querySelector('.btn-label');
    if (!label) {
      if (btn.children.length) return;              // custom markup — leave alone
      var text = (btn.textContent || '').trim();
      if (!text) return;
      btn.textContent = '';
      label = document.createElement('span');
      label.className = 'btn-label';
      label.textContent = text;
      btn.appendChild(label);
    }

    var cs = getComputedStyle(btn);
    var availW = btn.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var availH = btn.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!(availW > 0) || !(availH > 0)) return;

    var lo = CONFIG.BTN_FONT_MIN;
    var hi = CONFIG.BTN_FONT_MAX;
    var best = lo;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      label.style.fontSize = mid + 'px';
      if (label.scrollWidth <= availW + 1 && label.scrollHeight <= availH + 1) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    label.style.fontSize = best + 'px';
  }

  // Free-floating text gets the same treatment as button labels.
  function fitAllButtonText(layer) {
    var els = layer.querySelectorAll('.region-btn, .free-text');
    for (var i = 0; i < els.length; i++) fitButtonText(els[i]);
  }

  // Fill any "days since last SMP update" counters with digit tiles.
  function populateSmpDays() {
    var els = document.querySelectorAll('.smp-days');
    if (!els.length) return;
    var lastUpdate = new Date('2026-01-14'); // change when the SMP updates
    var diffDays = Math.floor(Math.abs(new Date() - lastUpdate) / (1000 * 3600 * 24));
    var html = String(diffDays).split('').map(function (d) {
      return '<div style="background:#fff;padding:3px 6px;min-width:20px;' +
        'box-shadow:inset 0 2px 4px rgba(0,0,0,0.3);font-size:clamp(15px,2.8vh,30px);font-weight:bold;' +
        'color:#000;font-family:\'Arial Black\',sans-serif">' + d + '</div>';
    }).join('');
    for (var i = 0; i < els.length; i++) els[i].innerHTML = html;
  }

  function renderRegion(layer, def, rect, scale, sizeMul) {
    var el = document.createElement('div');
    el.className = 'region';
    if (def.id) el.dataset.regionId = def.id;
    // Position by center so the CSS translate(-50%,-50%) + scale is stable.
    if (typeof sizeMul !== 'number') sizeMul = sizeMulFor(def);
    el.style.left = (rect.x + rect.w / 2) + 'px';
    el.style.top = (rect.y + rect.h / 2) + 'px';
    el.style.width = (def.baseW * sizeMul) + 'px';
    el.style.height = (def.baseH * sizeMul) + 'px';
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

    // Seed-determined shape for this button.
    applyShape(def, el.firstElementChild);
    // Seed-determined font-size / font-family for plain text buttons.
    applyFont(def, el.querySelector('.region-btn'));
    // Seed-determined highly saturated color for plain text buttons.
    applyColor(def, el.querySelector('.region-btn'));

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

    // Keyboard shortcuts: p → cinema, s → splat, g → green, b → birds,
    // c → background mode, ricky/sorry easter eggs.
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
        if (key === 'b') {
          flyBirds();
        }
        if (key === 'c') {
          toggleBgMosaic();
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
    // Before renderAll: the very first buildBackground() has to already know
    // which mode we're in, or the saved choice flashes the wrong background.
    loadBgPreference();
    renderAll();
    setupInteractions();
    setupLogoAudio();
    scheduleBirds();
    window.addEventListener('resize', onResize);
    // The cookie banner is injected after this script runs; re-layout when it
    // appears or is dismissed so nothing hides underneath it.
    window.addEventListener('load', onResize);
    if (window.MutationObserver && document.body) {
      var hasBanner = function (nodes) {
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i] && nodes[i].id === 'noob-cookie-banner') return true;
        }
        return false;
      };
      new MutationObserver(function (muts) {
        for (var m = 0; m < muts.length; m++) {
          if (hasBanner(muts[m].addedNodes) || hasBanner(muts[m].removedNodes)) {
            onResize();
            return;
          }
        }
      }).observe(document.body, { childList: true });
    }
  }

  // The NOOBULAR logo is the only thing that starts the ohyeah track — there
  // is no controls bar any more. Clicking it again stops it, since hiding the
  // controls would otherwise leave no way to shut it off. The click is a user
  // gesture, so browsers allow playback with sound.
  function setupLogoAudio() {
    var logo = document.querySelector('.noob-logo');
    var audio = document.getElementById('ohyeah-audio');
    if (!logo || !audio) return;

    function toggle() {
      if (audio.paused) {
        audio.play().catch(function () {});
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
    }

    logo.addEventListener('click', toggle);
    logo.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
