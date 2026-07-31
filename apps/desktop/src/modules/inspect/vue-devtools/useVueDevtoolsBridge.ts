import { computed, ref } from "vue";
import type { RPCFunctions } from "@vue/devtools-core";
import {
  createRpcClient,
  createRpcServer,
  getRpcServer,
  setIframeServerContext,
} from "@vue/devtools-kit";
import { useCDP } from "@/composables/useCDP";
import {
  VUE_APP_REGISTRATION_EXPRESSION,
  VUE_CAPABILITY_PROBE_EXPRESSION,
  interpretVueCapability,
  parseAppRegistration,
  parseVueCapabilityProbe,
} from "./capability";
import type { VueCapabilityReport } from "./capability";
import type { CDPTarget } from "@/types/cdp.types";
import type { CDPClient } from "@capubridge/cdp-protocol";
import userAppBundle from "@vue/devtools-electron/dist/user-app.iife.js?raw";
import devtoolsPanelScriptUrl from "@vue/devtools-electron/client/devtools-panel.js?url";
import devtoolsPanelStyleUrl from "@vue/devtools-electron/client/devtools-panel.css?url";

type BridgeStatus =
  | "idle"
  | "probing"
  | "booting"
  | "reloading"
  | "ready"
  | "stalled"
  | "unsupported"
  | "error";
type RemoteRpcClient = Record<string, (...args: unknown[]) => Promise<unknown>>;
type TargetMessageHandler = (message: unknown) => void;
type RuntimeBindingCalledEvent = {
  name?: string;
  payload?: string;
};
type HostRpcFunctions = Record<string, (...args: unknown[]) => Promise<unknown>>;
type TargetLocalFunctions = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  once: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
  heartbeat: () => boolean;
};

const TARGET_BINDING_NAME = "__capubridgeVueDevtoolsBinding";
const TARGET_RECEIVE_NAME = "__capubridgeVueDevtoolsReceive";
const TARGET_READY_FLAG = "__capubridgeVueDevtoolsReady";
const PROXY_TO_SERVER_SOURCE = "proxy->server";
const SERVER_TO_PROXY_SOURCE = "server->proxy";

const CONNECTED_TIMEOUT_MS = 20_000;

const status = ref<BridgeStatus>("idle");
const errorMessage = ref<string | null>(null);
const capability = ref<VueCapabilityReport | null>(null);

let hostServerInitialized = false;
let currentRemoteRpcClient: RemoteRpcClient | null = null;
let currentBridgeClient: CDPClient | null = null;
let currentBridgeTargetId: string | null = null;
let targetReady = false;
let targetChannelCleanup: (() => void) | null = null;
let startPromise: Promise<void> | null = null;
let currentIframe: HTMLIFrameElement | null = null;
let lastIframeRefreshAt = 0;
let targetServerListenerInitialized = false;
let didStateConnectedRefresh = false;
let connectedWatchdog: number | null = null;
let installedScriptIdentifier: string | null = null;
let installedScriptClient: CDPClient | null = null;

function clearConnectedWatchdog() {
  if (connectedWatchdog === null) return;
  window.clearTimeout(connectedWatchdog);
  connectedWatchdog = null;
}

/**
 * The heartbeat only proves the injected runtime answers RPC. The panel stays
 * empty until the app itself registers on the DevTools hook, so give up waiting
 * out loud instead of spinning forever.
 */
function startConnectedWatchdog() {
  clearConnectedWatchdog();
  connectedWatchdog = window.setTimeout(() => {
    connectedWatchdog = null;
    if (didStateConnectedRefresh) return;
    if (status.value !== "ready") return;
    status.value = "stalled";
  }, CONNECTED_TIMEOUT_MS);
}

function markTargetConnected() {
  clearConnectedWatchdog();
  if (status.value === "stalled") status.value = "ready";
}

function buildFrameHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${devtoolsPanelStyleUrl}" />
    <style>
      html, body, #app {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #0b0f14;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      (() => {
        const globalObject = typeof globalThis !== "undefined" ? globalThis : window;
        if (!globalObject.process) globalObject.process = { env: { NODE_ENV: "production" } };
        if (!globalObject.process.env) globalObject.process.env = { NODE_ENV: "production" };
        if (!globalObject.process.env.NODE_ENV) globalObject.process.env.NODE_ENV = "production";
      })();
    </script>
    <script type="module" src="${devtoolsPanelScriptUrl}"></script>
  </body>
</html>`;
}

function refreshIframeClient(_reason: string) {
  const now = Date.now();
  if (now - lastIframeRefreshAt < 220) return;
  lastIframeRefreshAt = now;

  try {
    const iframeWindow = currentIframe?.contentWindow as
      | (Window & { __capubridgeReloadVueDevtoolsClient?: () => void })
      | null;
    const reloadClient = iframeWindow?.__capubridgeReloadVueDevtoolsClient;
    if (typeof reloadClient === "function") {
      reloadClient();
    }
  } catch (error) {
    console.warn("Failed to refresh Vue DevTools iframe client", error);
  }
}

function deserializeTransportMessage(message: string) {
  try {
    return JSON.parse(message) as unknown;
  } catch {
    return message;
  }
}

function unwrapTransportEnvelope(message: unknown) {
  if (
    typeof message === "object" &&
    message !== null &&
    "json" in (message as Record<string, unknown>)
  ) {
    return (message as { json: unknown }).json;
  }
  return message;
}

function hasReadyFlag(message: unknown) {
  if (typeof message !== "object" || message === null) return false;
  if (TARGET_READY_FLAG in (message as Record<string, unknown>)) return true;
  if ("json" in (message as Record<string, unknown>)) {
    const inner = (message as { json: unknown }).json;
    if (typeof inner === "object" && inner !== null) {
      return TARGET_READY_FLAG in (inner as Record<string, unknown>);
    }
  }
  return false;
}

function isRpcPacket(message: unknown) {
  if (typeof message !== "object" || message === null) return false;
  const record = message as Record<string, unknown>;
  return typeof record.m === "string" && typeof record.t === "string";
}

function buildTargetRuntimeSource() {
  const shim = `var __capubridgeGlobal=typeof globalThis!=="undefined"?globalThis:window;if(!__capubridgeGlobal.process)__capubridgeGlobal.process={env:{NODE_ENV:"production"}};if(!__capubridgeGlobal.process.env)__capubridgeGlobal.process.env={NODE_ENV:"production"};if(!__capubridgeGlobal.process.env.NODE_ENV)__capubridgeGlobal.process.env.NODE_ENV="production";var process=__capubridgeGlobal.process;`;
  const replacement = `function j3(){var t=typeof globalThis!=="undefined"?globalThis:window;var b=${JSON.stringify(TARGET_BINDING_NAME)};var v=${JSON.stringify(TARGET_RECEIVE_NAME)};var p=${JSON.stringify(PROXY_TO_SERVER_SOURCE)};var h=${JSON.stringify(SERVER_TO_PROXY_SOURCE)};var k1="__capubridgeVueDevtoolsProxyListener";var k2="__capubridgeVueDevtoolsServerForwarder";function e(i){try{if(i&&typeof i==="object"&&typeof i.t==="string")return i;if(typeof i!=="string")i=JSON.stringify(i);var n=JSON.parse(i);if(n&&typeof n==="object"){if(typeof n.t==="string")return n;if("json" in n){var r=n.json;if(r&&typeof r==="object"&&typeof r.t==="string")return r}}}catch(o){return null}}function s(i){try{return JSON.stringify(i)}catch(o){return""}}function n(i){if(typeof i!=="string"){i=s(i)}if(!i)return;t[b](i)}function r(){return{post:function(i){if(!i||typeof i!=="object"||typeof i.t!=="string")return;t.postMessage({source:h,payload:s(i)},"*")},on:function(i){t[v]=function(o){var a=e(o);if(a&&typeof a.t==="string")i(a)};if(!t[k1]){t[k1]=!0;t.addEventListener("message",function(o){var a=o&&o.data;if(!a||a.source!==p)return;var l=e(a.payload);if(l&&typeof l.t==="string")i(l)})}if(!t[k2]){t[k2]=!0;t.addEventListener("message",function(o){var a=o&&o.data;if(!a||a.source!==h)return;n(a.payload)})}}}}_t.init();o0(uv,{channel:r()});uv.initDevToolsServerListener();var o={};o[${JSON.stringify(TARGET_READY_FLAG)}]=!0;n(o)}j3();`;
  const patchedBundle = userAppBundle.replace(
    /function j3\(t\)\{[\s\S]*?j3\(K3\.default\);/,
    replacement,
  );

  if (patchedBundle === userAppBundle) {
    throw new Error("Failed to patch official Vue DevTools runtime");
  }

  return `${shim}${patchedBundle}`;
}

const targetRuntimeSource = buildTargetRuntimeSource();

function createRemoteEventRelay() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  const on = (event: string, handler: (...args: unknown[]) => void) => {
    const existing = handlers.get(event) ?? new Set<(...args: unknown[]) => void>();
    existing.add(handler);
    handlers.set(event, existing);
  };

  const off = (event: string, handler: (...args: unknown[]) => void) => {
    handlers.get(event)?.delete(handler);
  };

  return {
    on,
    off,
    once(event: string, handler: (...args: unknown[]) => void) {
      const onceHandler = (...args: unknown[]) => {
        off(event, onceHandler);
        handler(...args);
      };
      on(event, onceHandler);
    },
    emit(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((handler) => {
        handler(...args);
      });
      void getRpcServer<RPCFunctions>()?.broadcast.emit(event, ...args);
    },
    heartbeat() {
      return true;
    },
  };
}

const remoteEventRelay = createRemoteEventRelay();

const hostRpcFunctions = new Proxy<HostRpcFunctions>(
  {},
  {
    get(_target, property) {
      if (typeof property !== "string") return undefined;
      return async (...args: unknown[]) => {
        if (property === "on") {
          const [event, handler] = args;
          if (typeof event !== "string" || typeof handler !== "function") return;
          remoteEventRelay.on(event, handler as (...eventArgs: unknown[]) => void);
          return;
        }

        if (property === "off") {
          const [event, handler] = args;
          if (typeof event !== "string" || typeof handler !== "function") return;
          remoteEventRelay.off(event, handler as (...eventArgs: unknown[]) => void);
          return;
        }

        if (property === "once") {
          const [event, handler] = args;
          if (typeof event !== "string" || typeof handler !== "function") return;
          remoteEventRelay.once(event, handler as (...eventArgs: unknown[]) => void);
          return;
        }

        const shouldInitServerListener = property === "initDevToolsServerListener";
        if (shouldInitServerListener) {
          if (targetServerListenerInitialized) {
            return true;
          }
          targetServerListenerInitialized = true;
          return true;
        }

        const remoteMethod = currentRemoteRpcClient?.[property];
        if (typeof remoteMethod !== "function") {
          throw new Error(`Vue DevTools target not ready for ${property}`);
        }
        return await remoteMethod(...args);
      };
    },
  },
);

function ensureHostServer(iframe: HTMLIFrameElement) {
  setIframeServerContext(iframe);
  if (hostServerInitialized) return;
  createRpcServer<RPCFunctions, HostRpcFunctions>(hostRpcFunctions, { preset: "iframe" });
  hostServerInitialized = true;
}

async function dispatchMessageToTarget(client: CDPClient, message: string) {
  const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
    expression: `(() => {
      const payload = ${message};
      let posted = false;
      try {
        window.postMessage({
          source: ${JSON.stringify(PROXY_TO_SERVER_SOURCE)},
          payload,
        }, "*");
        posted = true;
      } catch {
        posted = false;
      }
      if (posted) return true;
      const receiver = globalThis[${JSON.stringify(TARGET_RECEIVE_NAME)}];
      if (typeof receiver !== "function") return false;
      receiver(payload);
      return true;
    })()`,
    returnByValue: true,
  });
  return (result.result as Record<string, unknown>).value === true;
}

function cleanupTargetChannel() {
  targetChannelCleanup?.();
  targetChannelCleanup = null;
}

async function waitForTargetReady(timeoutMs: number) {
  const started = Date.now();

  while (!targetReady && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 60));
  }

  return targetReady;
}

async function injectRuntimeIntoCurrentContext(client: CDPClient) {
  try {
    await client.send("Runtime.evaluate", {
      expression: targetRuntimeSource,
      returnByValue: false,
      awaitPromise: false,
    });
    return true;
  } catch {
    return false;
  }
}

async function isAppRegistered(client: CDPClient) {
  try {
    const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
      expression: VUE_APP_REGISTRATION_EXPRESSION,
      returnByValue: true,
    });
    return parseAppRegistration((result.result as Record<string, unknown>).value);
  } catch {
    return false;
  }
}

async function waitForAppRegistration(client: CDPClient, timeoutMs: number) {
  const started = Date.now();

  do {
    if (await isAppRegistered(client)) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  } while (Date.now() - started < timeoutMs);

  return false;
}

async function tryReloadTarget(client: CDPClient) {
  try {
    await client.send("Page.reload", { ignoreCache: true });
    return true;
  } catch (error) {
    console.warn("Page.reload unavailable; using runtime reload fallback", error);
  }

  try {
    await client.send("Runtime.evaluate", {
      expression: "(() => { location.reload(); return true; })()",
      returnByValue: true,
    });
    return true;
  } catch {
    return false;
  }
}

function createTargetChannel(client: CDPClient) {
  const listeners = new Set<TargetMessageHandler>();
  const pendingMessages: unknown[] = [];

  const flushPendingMessages = () => {
    if (!targetReady) return;
    const queue = pendingMessages.splice(0, pendingMessages.length);
    queue.forEach((message) => {
      void dispatchMessageToTarget(client, JSON.stringify(message)).then((delivered) => {
        if (!delivered) {
          targetReady = false;
          pendingMessages.unshift(message);
        }
      });
    });
  };

  const bindingCleanup = client.on("Runtime.bindingCalled", (event) => {
    const payload = event as RuntimeBindingCalledEvent;
    if (payload.name !== TARGET_BINDING_NAME || typeof payload.payload !== "string") return;
    const rawMessage = deserializeTransportMessage(payload.payload);
    const message = unwrapTransportEnvelope(rawMessage);
    if (hasReadyFlag(rawMessage) || hasReadyFlag(message)) {
      targetReady = true;
      flushPendingMessages();
      refreshIframeClient("target-ready");
      return;
    }

    if (!targetReady && isRpcPacket(message)) {
      targetReady = true;
      flushPendingMessages();
      refreshIframeClient("rpc-ready");
    }

    if (isRpcPacket(message)) {
      const packet = message as { m?: unknown; a?: unknown[] };
      const eventName = packet.m === "emit" && Array.isArray(packet.a) ? packet.a[0] : null;
      const eventPayload = packet.m === "emit" && Array.isArray(packet.a) ? packet.a[1] : null;
      if (
        eventName === "devtools-state-updated" &&
        typeof eventPayload === "object" &&
        eventPayload !== null &&
        (eventPayload as { connected?: boolean }).connected === true &&
        !didStateConnectedRefresh
      ) {
        didStateConnectedRefresh = true;
        markTargetConnected();
        refreshIframeClient("state-connected");
      }
    }

    listeners.forEach((handler) => {
      handler(message);
    });
  });

  const runtimeResetCleanup = client.on("Runtime.executionContextsCleared", () => {
    targetReady = false;
  });

  return {
    channel: {
      post: async (message: unknown) => {
        if (
          !message ||
          typeof message !== "object" ||
          typeof (message as Record<string, unknown>).t !== "string"
        ) {
          return;
        }

        if (!targetReady) {
          pendingMessages.push(message);
          return;
        }
        const delivered = await dispatchMessageToTarget(client, JSON.stringify(message));
        if (!delivered) {
          targetReady = false;
          pendingMessages.push(message);
        }
      },
      on: (handler: TargetMessageHandler) => {
        listeners.add(handler);
      },
    },
    cleanup: () => {
      bindingCleanup();
      runtimeResetCleanup();
      listeners.clear();
      pendingMessages.splice(0, pendingMessages.length);
    },
  };
}

async function ensureTargetRuntime(client: CDPClient, target: CDPTarget) {
  const sameBridge = currentBridgeClient === client && currentBridgeTargetId === target.id;
  if (sameBridge && currentRemoteRpcClient && targetReady) {
    status.value = "ready";
    return;
  }

  cleanupTargetChannel();

  currentBridgeClient = client;
  currentBridgeTargetId = target.id;
  currentRemoteRpcClient = null;
  targetReady = false;
  targetServerListenerInitialized = false;
  didStateConnectedRefresh = false;

  await client.send("Runtime.enable", {});

  try {
    await client.send("Page.enable", {});
  } catch (error) {
    console.warn("Vue DevTools could not enable the Page domain", error);
  }

  try {
    await client.send("Runtime.addBinding", { name: TARGET_BINDING_NAME });
  } catch (error) {
    console.warn("Vue DevTools could not register the runtime binding", error);
  }

  const targetChannel = createTargetChannel(client);
  targetChannelCleanup = targetChannel.cleanup;

  currentRemoteRpcClient = createRpcClient<RPCFunctions, TargetLocalFunctions>(remoteEventRelay, {
    channel: targetChannel.channel,
  }) as unknown as RemoteRpcClient | null;

  status.value = "reloading";

  // Re-adding without removing stacks a fresh copy per attach, so every later
  // page load would boot the runtime N times over the same globals.
  if (installedScriptIdentifier && installedScriptClient === client) {
    try {
      await client.send("Page.removeScriptToEvaluateOnNewDocument", {
        identifier: installedScriptIdentifier,
      });
    } catch (error) {
      console.warn("Vue DevTools could not remove its previous boot script", error);
    }
    installedScriptIdentifier = null;
  }

  const installed = await client.send<{ identifier?: string }>(
    "Page.addScriptToEvaluateOnNewDocument",
    { source: targetRuntimeSource },
  );
  installedScriptIdentifier = installed.identifier ?? null;
  installedScriptClient = client;

  await injectRuntimeIntoCurrentContext(client);
  await waitForTargetReady(1200);

  // A live transport is not a usable DevTools session: the hook we just injected
  // is useless to a Vue app that booted before it. Only the app actually being
  // registered lets us skip the reload the boot script needs to win that race.
  const registered = await waitForAppRegistration(client, 1500);
  if (registered) {
    return;
  }

  await tryReloadTarget(client);
  await waitForTargetReady(8000);
}

async function probeCapability(client: CDPClient) {
  const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
    expression: VUE_CAPABILITY_PROBE_EXPRESSION,
    returnByValue: true,
  });
  const value = (result.result as Record<string, unknown>).value;
  return interpretVueCapability(parseVueCapabilityProbe(value));
}

async function waitForRemoteHeartbeat() {
  if (!currentRemoteRpcClient) {
    throw new Error("Vue DevTools bridge not initialized");
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const heartbeat = currentRemoteRpcClient["heartbeat"];
      if (typeof heartbeat !== "function") {
        throw new Error("Vue DevTools heartbeat unavailable");
      }
      await heartbeat();
      status.value = "ready";
      errorMessage.value = null;
      return;
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }
  }

  throw new Error("Vue DevTools target did not become ready");
}

function statusLabelFor(value: BridgeStatus) {
  if (value === "probing") return "Checking the Vue runtime on the target";
  if (value === "booting") return "Preparing official Vue DevTools";
  if (value === "reloading") return "Reloading target to inject official Vue DevTools";
  if (value === "ready") return "Official Vue DevTools ready";
  if (value === "stalled") return "Bridge attached, but the app never registered";
  if (value === "unsupported") return "Vue DevTools cannot attach to this build";
  if (value === "error") return "Vue DevTools failed to start";
  return "Waiting for Vue DevTools";
}

export function useVueDevtoolsBridge() {
  const cdp = useCDP();

  async function resolveTargetClient() {
    const target = cdp.targetsStore.selectedTarget;
    if (!target) {
      throw new Error("Select target before opening Vue DevTools");
    }

    let client = cdp.activeClient.value;
    if (!client) {
      client = await cdp.connectToTarget(target);
    }

    return { client, target };
  }

  async function attachIframe(iframe: HTMLIFrameElement | null) {
    if (!iframe) return;
    currentIframe = iframe;
    ensureHostServer(iframe);
  }

  async function start(options?: { force?: boolean }) {
    if (startPromise) return startPromise;

    status.value = "probing";
    errorMessage.value = null;
    clearConnectedWatchdog();

    startPromise = (async () => {
      try {
        const { client, target } = await resolveTargetClient();

        const report = await probeCapability(client);
        capability.value = report;
        if (report.kind !== "ready" && !options?.force) {
          // Injecting anyway would reload the user's app for nothing.
          status.value = "unsupported";
          return;
        }

        status.value = "booting";
        await ensureTargetRuntime(client, target);
        await waitForRemoteHeartbeat();
        startConnectedWatchdog();
      } catch (error) {
        status.value = "error";
        errorMessage.value = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        startPromise = null;
      }
    })();

    return startPromise;
  }

  return {
    attachIframe,
    start,
    frameHtml: buildFrameHtml(),
    status,
    errorMessage,
    capability,
    statusLabel: computed(() => statusLabelFor(status.value)),
    isReady: computed(() => status.value === "ready"),
    // The panel iframe is usable (if empty) once the bridge attached.
    isAttached: computed(() => status.value === "ready" || status.value === "stalled"),
    isBlocked: computed(() => status.value === "unsupported"),
  };
}
