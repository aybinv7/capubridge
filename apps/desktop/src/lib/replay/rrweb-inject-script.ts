import rrwebIife from "rrweb/dist/rrweb-all.min.js?raw";

export function buildInjectionScript(): string {
  return `${rrwebIife}\n${buildRecorderBootstrap()}`;
}

export function buildRecorderBootstrap(): string {
  return `
(function() {
  'use strict';

  if (window.__capuRrwebStarted) { return; }
  window.__capuRrwebStarted = true;

  var __capuBuffer = [];
  var __capuEventSizes = [];
  var __capuBufferBytes = 0;
  var __capuDroppedEvents = 0;
  var __capuTimer = null;
  var __capuStopped = false;
  var __capuRecorderStop = null;
  var __capuMaxEvents = 500;
  var __capuMaxBytes = 4 * 1024 * 1024;

  function __capuFlush() {
    if (__capuBuffer.length === 0) { __capuTimer = null; return; }
    if (typeof window.__capuEmit !== 'function') {
      if (__capuStopped) { __capuTimer = null; return; }
      __capuTimer = setTimeout(__capuFlush, 100);
      return;
    }
    try {
      var payload = __capuBuffer;
      if (__capuDroppedEvents > 0) {
        payload = [{ __capuTruncated: true, droppedEvents: __capuDroppedEvents }].concat(payload);
      }
      window.__capuEmit(JSON.stringify(payload));
      __capuBuffer = [];
      __capuEventSizes = [];
      __capuBufferBytes = 0;
      __capuDroppedEvents = 0;
    } catch (e) {
      __capuTimer = setTimeout(__capuFlush, 100);
      return;
    }
    __capuTimer = null;
  }

  function __capuScheduleFlush() {
    if (!__capuTimer) {
      __capuTimer = setTimeout(__capuFlush, 50);
    }
  }

  if (typeof rrweb === 'undefined' || typeof rrweb.record !== 'function') {
    if (typeof window.__capuEmit === 'function') {
      try { window.__capuEmit(JSON.stringify([{ __capuError: 'rrweb global not found' }])); } catch (e) { console.warn('[capubridge] Failed to report rrweb injection error', e); }
    }
    window.__capuRrwebStarted = false;
    return;
  }

  try {
    __capuRecorderStop = rrweb.record({
      emit: function(event) {
      var eventBytes = 0;
      try { eventBytes = new TextEncoder().encode(JSON.stringify(event)).byteLength; } catch (e) { eventBytes = 0; }
      __capuBuffer.push(event);
      __capuEventSizes.push(eventBytes);
      __capuBufferBytes += eventBytes;
      while (__capuBuffer.length > __capuMaxEvents || __capuBufferBytes > __capuMaxBytes) {
        __capuBuffer.shift();
        __capuBufferBytes -= __capuEventSizes.shift() || 0;
        __capuDroppedEvents += 1;
      }
      __capuScheduleFlush();
      },
      recordCanvas: false,
      recordCrossOriginIframes: false,
      collectFonts: true,
      inlineImages: true,
      inlineFonts: true,
    });
  } catch (e) {
    window.__capuRrwebStarted = false;
    if (typeof window.__capuEmit === 'function') {
      try { window.__capuEmit(JSON.stringify([{ __capuError: 'rrweb recorder failed to start' }])); } catch (emitError) { console.warn('[capubridge] Failed to report rrweb startup error', emitError); }
    }
    return;
  }

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

  var __capuPushWrapper = function() {
    __capuOrigPush.apply(this, arguments);
    __capuEmitRouteChange(window.location.href);
  };

  var __capuReplaceWrapper = function() {
    __capuOrigReplace.apply(this, arguments);
    __capuEmitRouteChange(window.location.href);
  };

  history.pushState = __capuPushWrapper;
  history.replaceState = __capuReplaceWrapper;

  var __capuPopHandler = function() {
    __capuEmitRouteChange(window.location.href);
  };
  window.addEventListener('popstate', __capuPopHandler);

  window.__capuStopRrweb = function() {
    if (__capuStopped) { return { stopped: false, alreadyStopped: true }; }
    __capuStopped = true;
    var __capuWasTruncated = __capuDroppedEvents > 0;
    if (__capuTimer) { clearTimeout(__capuTimer); __capuTimer = null; }
    __capuFlush();
    if (typeof __capuRecorderStop === 'function') { __capuRecorderStop(); }
    if (history.pushState === __capuPushWrapper) { history.pushState = __capuOrigPush; }
    if (history.replaceState === __capuReplaceWrapper) { history.replaceState = __capuOrigReplace; }
    window.removeEventListener('popstate', __capuPopHandler);
    window.__capuRrwebStarted = false;
    return { stopped: true, truncated: __capuWasTruncated };
  };
})();
`;
}
