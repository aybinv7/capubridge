import backendBundle from "react-devtools-core/dist/backend.js?raw";

/**
 * Target-side runtime for the React DevTools bridge.
 *
 * Unlike the Vue equivalent this needs no bundle patching: react-devtools-core
 * ships `dist/backend.js` as a UMD bundle that exposes `ReactDevToolsBackend`
 * on the global, with `initialize` and `connectToDevTools` as public entry
 * points. We only append a bootstrap that wires `connectToDevTools` to a
 * WebSocket-shaped object backed by the CDP channel, so no socket is opened on
 * the device — Android's network security policy blocks cleartext loopback
 * WebSockets (`ERR_CLEARTEXT_NOT_PERMITTED`) regardless of `adb reverse`.
 */

export const TARGET_BINDING_NAME = "__capubridgeReactDevtoolsBinding";
export const TARGET_RECEIVE_NAME = "__capubridgeReactDevtoolsReceive";
export const TARGET_READY_FLAG = "__capubridgeReactDevtoolsReady";
export const TARGET_INSTALLED_FLAG = "__capubridgeReactDevtoolsInstalled";

function buildBootstrapSource() {
  return `(() => {
  var g = typeof globalThis !== "undefined" ? globalThis : window;
  var installed = ${JSON.stringify(TARGET_INSTALLED_FLAG)};
  var ready = ${JSON.stringify(TARGET_READY_FLAG)};
  var bindingName = ${JSON.stringify(TARGET_BINDING_NAME)};
  var receiveName = ${JSON.stringify(TARGET_RECEIVE_NAME)};

  function notify(payload) {
    try {
      var fn = g[bindingName];
      if (typeof fn === "function") fn(typeof payload === "string" ? payload : JSON.stringify(payload));
    } catch (error) {}
  }

  // Re-injection must not stack a second backend. The Vue bridge showed the
  // cost of getting this wrong: each extra init both emits and subscribes, so
  // N inits deliver N*N messages per update.
  if (g[installed]) {
    notify({ event: ready, payload: [true] });
    return;
  }

  var backend = g.ReactDevToolsBackend;
  if (!backend || typeof backend.connectToDevTools !== "function") return;
  g[installed] = true;

  var socket = {
    OPEN: 1,
    readyState: 1,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send: function (data) { notify(String(data)); },
    close: function () {
      socket.readyState = 3;
      if (typeof socket.onclose === "function") socket.onclose({ code: 1000 });
    },
  };

  g[receiveName] = function (raw) {
    if (typeof socket.onmessage === "function") socket.onmessage({ data: raw });
  };

  // initialize() installs __REACT_DEVTOOLS_GLOBAL_HOOK__ and must run before
  // react-dom loads; connectToDevTools on its own does not install the hook.
  try {
    backend.initialize();
  } catch (error) {
    g.__capubridgeReactInitError = String(error);
  }

  try {
    backend.connectToDevTools({ websocket: socket, isAppActive: function () { return true; } });
  } catch (error) {
    g.__capubridgeReactConnectError = String(error);
    return;
  }

  if (typeof socket.onopen === "function") socket.onopen();
  notify({ event: ready, payload: [true] });
})()`;
}

export function buildTargetRuntimeSource() {
  if (!backendBundle.includes("ReactDevToolsBackend")) {
    throw new Error("react-devtools-core backend bundle no longer exposes ReactDevToolsBackend");
  }

  return `${backendBundle}\n;${buildBootstrapSource()};`;
}
