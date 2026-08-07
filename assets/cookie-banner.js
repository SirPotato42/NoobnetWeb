// the iconic legally binding noobular cookie banner
(function () {
  var scriptSrc = (document.currentScript && document.currentScript.src) || 'assets/cookie-banner.js';
  var reggUrl = new URL('images/regg.png', scriptSrc).href;


  var COOKIE = '\uD83C\uDF6A';
  var THUMBSUP = '\uD83D\uDC4D';

  var FINE_PRINT = [
    'this banner is legally binding in all 8.1 billion noobular jurisdictions | cookies may contain eggs | ',
    'Noobular is not responsible for your dog | best viewed in Netscape Navigator 4.0 | side effects may include: hair loss, 24 hour blindness | ok cookies DEFINITELY contain eggs | ',
    'clicking accept will automatically order 1000 worms from Uncle Jim | clicking decline will automatically order 1000 worms from uncle jim | follow my blog at https://noobular.com | ',
    'cookies are kosher and halal ' + THUMBSUP
  ].join('');

  function injectStyles() {
    if (document.getElementById('noob-cookie-styles')) return;
    var styles = document.createElement('style');
    styles.id = 'noob-cookie-styles';
    styles.textContent = [
      '@keyframes noob-cookie-rainbow {',
      '  0%   { border-color: red; }',
      '  16%  { border-color: orange; }',
      '  33%  { border-color: yellow; }',
      '  50%  { border-color: lime; }',
      '  66%  { border-color: cyan; }',
      '  83%  { border-color: magenta; }',
      '  100% { border-color: red; }',
      '}',
      '@keyframes noob-cookie-blink {',
      '  0%, 49%   { visibility: visible; }',
      '  50%, 100% { visibility: hidden; }',
      '}',
      // two identical copies slide left by exactly one copy width, so the
      // loop point is invisible and the text never leaves a dead gap
      '@keyframes noob-cookie-scroll {',
      '  from { transform: translateX(0); }',
      '  to   { transform: translateX(-50%); }',
      '}',
      '#noob-cookie-banner {',
      '  position: fixed; bottom: 0; left: 0; width: 100%; box-sizing: border-box;',
      '  z-index: 9998; background-color: black; color: lime;',
      '  border-top: 8px ridge red; animation: noob-cookie-rainbow 1s linear infinite;',
      '  font-family: "Comic Sans MS", "Comic Sans", cursive; text-align: center;',
      '  padding: 10px 12px 14px 12px;',
      '}',
      '#noob-cookie-banner .noob-cookie-blink { animation: noob-cookie-blink 0.7s steps(1) infinite; }',
      '#noob-cookie-banner h3 {',
      '  margin: 0 0 6px 0; font-size: 34px; color: yellow;',
      '  background-color: purple; text-shadow: 3px 3px 0 red;',
      '}',
      '#noob-cookie-banner p {',
      '  margin: 0 0 10px 0; font-size: 22px; color: white;',
      '  background-color: navy; font-weight: bold;',
      '}',
      '#noob-cookie-banner .noob-cookie-buttons {',
      '  display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;',
      '}',
      '#noob-cookie-banner button {',
      '  border: 4px outset white; padding: 10px 26px; font-size: 24px;',
      '  font-weight: bold; cursor: pointer;',
      '  font-family: "Comic Sans MS", "Comic Sans", cursive;',
      '}',
      '#noob-cookie-banner button:active { border-style: inset; }',
      '#noob-cookie-accept { background-color: lime; color: black; }',
      '#noob-cookie-decline { background-color: red; color: white; }',
      '#noob-cookie-banner .noob-cookie-fine-print {',
      '  font-size: 12px; color: silver; margin-top: 8px;',
      '  overflow: hidden; white-space: nowrap;',
      '}',
      '#noob-cookie-banner .noob-cookie-ticker {',
      '  display: inline-block; white-space: nowrap;',
      '  animation: noob-cookie-scroll 45s linear infinite;',
      '}',
      '#noob-cookie-banner .noob-cookie-ticker span { padding-right: 60px; }'
    ].join('\n');
    document.head.appendChild(styles);
  }

  function buildBanner() {
    injectStyles();

    var banner = document.createElement('div');
    banner.id = 'noob-cookie-banner';
    banner.innerHTML = [
      '<h3><span class="noob-cookie-blink">' + COOKIE + '</span> MANDATORY!!! COOKIES!!! <span class="noob-cookie-blink">' + COOKIE + '</span></h3>',
      '<p>By clicking accept you cede all computer access to Big Noobular Co</p>',
      '<div class="noob-cookie-buttons">',
      '  <button id="noob-cookie-accept" type="button">ACCEPT</button>',
      '  <button id="noob-cookie-decline" type="button">DECLINE</button>',
      '</div>',
      '<div class="noob-cookie-fine-print">',
      '  <div class="noob-cookie-ticker">',
      '    <span>' + FINE_PRINT + '</span><span>' + FINE_PRINT + '</span>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(banner);

    document.getElementById('noob-cookie-accept').addEventListener('click', function () {
      downloadRegg();
      banner.remove();
      // deferred so the blocking alert isn't sitting in front of the download
      setTimeout(function () {
        alert('THANK YOU!!! We love you!!!');
      }, 400);
    });

    document.getElementById('noob-cookie-decline').addEventListener('click', function () {
      downloadRegg();

      banner.remove();
      setTimeout(init, 4000);
    });
  }

  function saveBlob(blob) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'regg.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadRegg() {

    fetch(reggUrl)
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.blob();
      })
      .then(saveBlob)
      .catch(function () {
        var link = document.createElement('a');
        link.href = reggUrl;
        link.download = 'regg.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  }

  window.noobDownloadRegg = downloadRegg;

  function init() {
    if (document.getElementById('noob-cookie-banner')) return;
    buildBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
