// Finrival conversion tracking for Google Ads (account AW-18535453558) and the cookie banner.
// Loaded on every site page (end of body) and on the Web Terminal at /terminal/ (in <head>,
// added by _build/build.mjs). Consent Mode, set in _build/partials/gtag.html, decides what
// Google may store: before a visitor accepts, conversions are sent only as cookieless pings.
(function () {
  if (typeof window.gtag !== 'function') return;

  var AW = 'AW-18535453558/';
  var LABELS = {
    appStoreClick: 'sUOxCMmKwrMdEPamsoZF',      // Outbound click, primary
    terminalClick: 'AaxoCObQ57gdEPamsoZF',      // Outbound click, secondary
    terminalPurchase: 'NcldCOPQ57gdEPamsoZF',   // Subscribe, primary
    proPageView: '6WWMCMyKwrMdEPamsoZF',        // Page view, secondary
    aiPageView: 'M6_5CM-KwrMdEPamsoZF',         // Page view, secondary
  };
  var KEY = 'finrival-consent-v2'; // must match _build/partials/gtag.html
  var path = location.pathname;
  var onTerminal = /^\/terminal(\/|$)/.test(path);

  var GA = 'G-H7WZNQXEYJ'; // Google Analytics, web stream "Finrival Client" (Realtime and reports)

  function convert(name, extra) {
    var params = { send_to: AW + LABELS[name] };
    for (var k in extra || {}) params[k] = extra[k];
    gtag('event', 'conversion', params);
  }

  // The same moments as Google Analytics events, so they show up live in Realtime
  function analytics(event, params) {
    var p = { send_to: GA, transport_type: 'beacon' };
    for (var k in params || {}) p[k] = params[k];
    gtag('event', event, p);
  }

  function appStoreClick(url, via) {
    dataLayer.push({ event: 'app_store_click', link_url: String(url), via: via, page_language: document.documentElement.lang });
    convert('appStoreClick', { transport_type: 'beacon' });
    analytics('app_store_click', { link_url: String(url).split('?')[0], via: via });
  }

  // Links: App Store anywhere, and links from the site into the Web Terminal. Capture phase,
  // so the Terminal's own handlers cannot stop it
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (/(^|\.)apps\.apple\.com$/.test(a.hostname)) return appStoreClick(a.href, 'link');
    if (!onTerminal && a.host === location.host && /^\/terminal(\/|$)/.test(a.pathname)) {
      dataLayer.push({ event: 'web_terminal_click', from_page: path });
      convert('terminalClick', { transport_type: 'beacon' });
      analytics('web_terminal_click', { from_page: path });
    }
  }, true);

  // The Web Terminal opens the App Store with window.open (React Native Linking), not a link
  var open = window.open;
  if (typeof open === 'function') {
    window.open = function (url) {
      try { if (/^https?:\/\/([a-z0-9-]+\.)*apps\.apple\.com\//i.test(String(url))) appStoreClick(url, 'open'); } catch (e) {}
      return open.apply(window, arguments);
    };
  }

  // Page views of the PRO and Finrival AI pages, in every language
  var page = path.replace(/index\.html$/, '').replace(/^\/(pl|tr)\//, '/');
  if (page === '/pro/') convert('proPageView');
  else if (page === '/ai/') convert('aiPageView');

  // Web Terminal purchase: Polar sends buyers back to /terminal/?pro=success&checkout_id=…
  // This runs before the Terminal removes those parameters. The checkout id is the
  // transaction id, so Google Ads counts each purchase once even if the page reloads
  if (onTerminal) {
    var query = new URLSearchParams(location.search);
    if (query.get('pro') === 'success') {
      var checkout = query.get('checkout_id') || '';
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(checkout)) checkout = '';
      dataLayer.push({ event: 'web_terminal_purchase', checkout_id: checkout });
      convert('terminalPurchase', checkout ? { transaction_id: checkout } : {});
      // Google Analytics "purchase" (Monetisation reports). The amount is only known to Polar,
      // so the Polar dashboard stays the source for who bought what and for how much
      analytics('purchase', { transaction_id: checkout || undefined, affiliation: 'Web Terminal (Polar)', items: [{ item_name: 'Finrival PRO', item_category: 'Web Terminal' }] });
    }
  }

  // Cookie banner (#consent): site pages render it from _build/partials/consent.html, the
  // Terminal from _build/partials/consent-terminal.html with the copy for every language
  function wireBanner() {
    var box = document.getElementById('consent');
    if (!box) return;
    var copy = box.getAttribute('data-copy');
    if (copy) {
      try {
        var all = JSON.parse(copy);
        // The site and Terminal language first (same choice on both), then the browser's
        var saved = null;
        try { saved = localStorage.getItem('@finrival_language') || localStorage.getItem('fr-lang'); } catch (e) {}
        var lang = (saved || navigator.language || 'en').slice(0, 2).toLowerCase();
        var c = all[lang] || all.en;
        box.querySelector('[data-text]').textContent = c.text + ' · ';
        var link = box.querySelector('a');
        link.textContent = c.policy;
        link.href = c.privacy;
        box.querySelector('[data-consent="denied"]').textContent = c.reject;
        box.querySelector('[data-consent="granted"]').textContent = c.accept;
        box.setAttribute('lang', all[lang] ? lang : 'en');
      } catch (e) {}
    }
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    if (stored !== 'granted' && stored !== 'denied') box.hidden = false;

    box.querySelectorAll('[data-consent]').forEach(function (b) {
      b.addEventListener('click', function () {
        var value = b.getAttribute('data-consent');
        try { localStorage.setItem(KEY, value); } catch (e) {}
        gtag('consent', 'update', { ad_storage: value, ad_user_data: value, ad_personalization: value, analytics_storage: value });
        dataLayer.push({ event: 'consent_update', consent: value });
        box.hidden = true;
      });
    });
    document.querySelectorAll('[data-consent-open]').forEach(function (b) {
      b.addEventListener('click', function () { box.hidden = false; box.querySelector('button').focus(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireBanner);
  else wireBanner();
})();
