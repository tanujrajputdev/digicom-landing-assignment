/*
 * debug-panel.js — QA overlay. Inert unless the page is loaded with ?debug=1.
 *
 * The cart request is simulated, so it never appears in the browser's Network
 * tab — there is nothing to inspect there. This panel makes the exchange
 * visible instead: the exact POST that would go to Shopify, the response the
 * mock returns, and every dataLayer push as it happens.
 *
 * It observes; it does not participate. It wraps cartApi.addToCart to tee the
 * request and response, and wraps dataLayer.push the same way a tag manager
 * would. Remove this file and nothing else changes.
 */
(function (ns) {
  'use strict';

  function isEnabled() {
    try {
      return new URLSearchParams(window.location.search).get('debug') === '1';
    } catch (err) {
      return false;
    }
  }

  if (!isEnabled()) return;

  var panel, log, count = 0;

  /* Styles live here so deleting this one file removes the feature entirely. */
  var CSS = [
    '.qa{position:fixed;right:16px;bottom:16px;z-index:9999;width:min(460px,calc(100vw - 32px));',
      'max-height:min(60vh,560px);display:flex;flex-direction:column;background:#1d1d1b;color:#e8e6e1;',
      'border:1px solid #3d5f60;border-radius:10px;box-shadow:0 18px 40px rgba(0,0,0,.35);',
      'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.5}',
    '.qa.is-collapsed .qa__log{display:none}',
    '.qa__head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #333;',
      'font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:11px}',
    '.qa__head span{flex:1}',
    '.qa__btn{padding:3px 10px;background:#2b2b28;color:#e8e6e1;border:1px solid #4a4a45;',
      'border-radius:4px;font:inherit;font-size:11px;cursor:pointer}',
    '.qa__btn:hover{background:#3d5f60;border-color:#3d5f60}',
    '.qa__log{overflow:auto;padding:8px 12px 12px}',
    '.qa__entry{padding:8px 0;border-bottom:1px dashed #333}',
    '.qa__entry:last-child{border-bottom:0}',
    '.qa__label{margin:0 0 4px;font-weight:700;letter-spacing:.02em}',
    '.qa__entry--req .qa__label{color:#9be0de}',
    '.qa__entry--ok  .qa__label{color:#8fd694}',
    '.qa__entry--err .qa__label{color:#f0968a}',
    '.qa__entry--evt .qa__label{color:#e8c07d}',
    '.qa__entry--note .qa__label{color:#9a978f;font-weight:400}',
    '.qa__code{margin:0;white-space:pre-wrap;word-break:break-word;color:#c9c6bf;font:inherit}',
    '@media (max-width:640px){.qa{right:8px;left:8px;bottom:8px;width:auto;max-height:45vh}}'
  ].join('');

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function build() {
    panel = document.createElement('aside');
    panel.className = 'qa';
    panel.setAttribute('aria-label', 'Cart and dataLayer inspector');

    var head = document.createElement('header');
    head.className = 'qa__head';

    var title = document.createElement('span');
    title.textContent = 'Cart / dataLayer inspector';

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'qa__btn';
    clear.textContent = 'Clear';
    clear.addEventListener('click', function () { log.textContent = ''; count = 0; });

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'qa__btn';
    toggle.textContent = 'Hide';
    toggle.addEventListener('click', function () {
      var collapsed = panel.classList.toggle('is-collapsed');
      toggle.textContent = collapsed ? 'Show' : 'Hide';
    });

    head.appendChild(title);
    head.appendChild(clear);
    head.appendChild(toggle);

    log = document.createElement('div');
    log.className = 'qa__log';

    panel.appendChild(head);
    panel.appendChild(log);
    document.body.appendChild(panel);

    entry('note', 'Ready. USE_MOCK_CART = ' + ns.config.USE_MOCK_CART +
      ' · page_variation = ' + ns.config.pageVariation);
  }

  function entry(kind, heading, body) {
    if (!log) return;
    count += 1;

    var row = document.createElement('div');
    row.className = 'qa__entry qa__entry--' + kind;

    var h = document.createElement('p');
    h.className = 'qa__label';
    h.textContent = String(count).padStart(2, '0') + '  ' + heading;
    row.appendChild(h);

    if (body !== undefined) {
      var pre = document.createElement('pre');
      pre.className = 'qa__code';
      pre.textContent = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      row.appendChild(pre);
    }

    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function wrapCartApi() {
    var original = ns.cartApi.addToCart;

    ns.cartApi.addToCart = function (options, transport) {
      var send = transport || function (url, init) { return window.fetch(url, init); };

      function spy(url, init) {
        entry('req',
          'POST ' + url + '  (' + (ns.config.USE_MOCK_CART ? 'mock transport' : 'live fetch') + ')',
          'headers: ' + JSON.stringify(init.headers) + '\nbody:    ' + init.body);

        return send(url, init).then(function (response) {
          /*
           * Buffer the body so it can be shown here and still be consumed by
           * cart-api.js — a real Response body can only be read once.
           */
          return response.json().then(function (data) {
            entry(response.ok ? 'ok' : 'err',
              'HTTP ' + response.status + (response.ok ? ' OK' : ' — request rejected'),
              data);

            return {
              ok: response.ok,
              status: response.status,
              json: function () { return Promise.resolve(data); }
            };
          });
        });
      }

      return original.call(ns.cartApi, options, spy);
    };
  }

  function wrapDataLayer() {
    window.dataLayer = window.dataLayer || [];
    var nativePush = Array.prototype.push;

    window.dataLayer.push = function () {
      var result = nativePush.apply(window.dataLayer, arguments);

      Array.prototype.forEach.call(arguments, function (item) {
        if (!item || typeof item !== 'object') return;
        /* The ecommerce:null reset is noise for a reader. */
        if (!item.event && item.ecommerce === null) return;
        entry('evt', 'dataLayer → ' + (item.event || '(no event name)'), item);
      });

      return result;
    };
  }

  function init() {
    injectStyles();
    build();
    wrapCartApi();
    wrapDataLayer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.Digicom = window.Digicom || {});
