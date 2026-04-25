// Vite ?raw import: loads the file content as a plain string at build time.
// This IIFE build of rrweb exposes `window.rrweb` when executed in the target WebView.
// The recorder is injected via CDP Page.addScriptToEvaluateOnNewDocument.
import rrwebIife from "rrweb/dist/rrweb-all.min.js?raw";

/**
 * Builds the script string to inject into a target WebView via CDP
 * `Page.addScriptToEvaluateOnNewDocument`.
 *
 * The injected script:
 * 1. Initialises the rrweb recorder (from the embedded IIFE)
 * 2. Batches emitted events every 50ms into a single JSON array
 * 3. Sends each batch via `window.__capuEmit(json)` — the Runtime.addBinding bridge
 * 4. Intercepts `history.pushState` / `replaceState` to emit route-change custom events
 *
 * The binding `window.__capuEmit` is set up by `Runtime.addBinding` BEFORE this
 * script runs. Events emitted before the binding is ready are buffered and retried.
 */
export function buildInjectionScript(): string {
  const initCode = `
(function() {
  'use strict';

  var __capuBuffer = [];
  var __capuTimer = null;

  function __capuFlush() {
    if (__capuBuffer.length > 0 && typeof window.__capuEmit === 'function') {
      try {
        window.__capuEmit(JSON.stringify(__capuBuffer));
      } catch (e) {
        // binding not yet ready — will retry on next tick
      }
      __capuBuffer = [];
    }
    __capuTimer = null;
  }

  function __capuScheduleFlush() {
    if (!__capuTimer) {
      __capuTimer = setTimeout(__capuFlush, 50);
    }
  }

  // Start rrweb recorder (rrweb must be available from the IIFE above)
  if (typeof rrweb !== 'undefined' && typeof rrweb.record === 'function') {
    rrweb.record({
      emit: function(event) {
        __capuBuffer.push(event);
        __capuScheduleFlush();
      },
      recordCanvas: false,
      recordCrossOriginIframes: false,
      collectFonts: false,
    });
  }

  // SPA route-change boundary injection
  var __capuLastUrl = window.location.href;
  var __capuOrigPush = history.pushState;
  var __capuOrigReplace = history.replaceState;

  function __capuEmitRouteChange(url) {
    if (url !== __capuLastUrl) {
      __capuLastUrl = url;
      if (typeof rrweb !== 'undefined' && typeof rrweb.addCustomEvent === 'function') {
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
