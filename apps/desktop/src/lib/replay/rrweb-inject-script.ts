import rrwebIife from "rrweb/dist/rrweb-all.min.js?raw";

export function buildInjectionScript(): string {
  const initCode = `
(function() {
  'use strict';

  if (window.__capuRrwebStarted) { return; }
  window.__capuRrwebStarted = true;

  var __capuBuffer = [];
  var __capuTimer = null;

  function __capuFlush() {
    if (__capuBuffer.length === 0) { __capuTimer = null; return; }
    if (typeof window.__capuEmit !== 'function') {
      __capuTimer = setTimeout(__capuFlush, 100);
      return;
    }
    try {
      window.__capuEmit(JSON.stringify(__capuBuffer));
      __capuBuffer = [];
    } catch (e) {}
    __capuTimer = null;
  }

  function __capuScheduleFlush() {
    if (!__capuTimer) {
      __capuTimer = setTimeout(__capuFlush, 50);
    }
  }

  if (typeof rrweb === 'undefined' || typeof rrweb.record !== 'function') {
    if (typeof window.__capuEmit === 'function') {
      try { window.__capuEmit(JSON.stringify([{ __capuError: 'rrweb global not found' }])); } catch (e) {}
    }
    return;
  }

  rrweb.record({
    emit: function(event) {
      __capuBuffer.push(event);
      __capuScheduleFlush();
    },
    recordCanvas: false,
    recordCrossOriginIframes: false,
    collectFonts: false,
  });

  var __capuLastUrl = window.location.href;
  var __capuOrigPush = history.pushState;
  var __capuOrigReplace = history.replaceState;

  function __capuEmitRouteChange(url) {
    if (url !== __capuLastUrl) {
      __capuLastUrl = url;
      if (typeof rrweb.addCustomEvent === 'function') {
        rrweb.addCustomEvent('capu:route-change', { url: url });
      }
    }
  }

  history.pushState = function() {
    __capuOrigPush.apply(this, arguments);
    __capuEmitRouteChange(window.location.href);
  };

  history.replaceState = function() {
    __capuOrigReplace.apply(this, arguments);
    __capuEmitRouteChange(window.location.href);
  };

  window.addEventListener('popstate', function() {
    __capuEmitRouteChange(window.location.href);
  });
})();
`;

  return `${rrwebIife}\n${initCode}`;
}
