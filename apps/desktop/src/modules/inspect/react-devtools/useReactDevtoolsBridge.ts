import { computed, ref } from "vue";
import standaloneScriptUrl from "react-devtools-core/dist/standalone.js?url";
import { useCDP } from "@/composables/useCDP";
import {
  REACT_CAPABILITY_PROBE_EXPRESSION,
  REACT_RENDERER_REGISTRATION_EXPRESSION,
  interpretReactCapability,
  parseReactCapabilityProbe,
} from "./capability";
import type { ReactCapabilityReport } from "./capability";
import { HOST_READY_FLAG, buildFrameHtml } from "./hostRuntime";
import {
  TARGET_BINDING_NAME,
  TARGET_READY_FLAG,
  TARGET_RECEIVE_NAME,
  buildTargetRuntimeSource,
} from "./targetRuntime";
import type { CDPTarget } from "@/types/cdp.types";
import type { CDPClient } from "@capubridge/cdp-protocol";

type BridgeStatus =
  | "idle"
  | "probing"
  | "booting"
  | "reloading"
  | "connecting"
  | "ready"
  | "unsupported"
  | "error";

/** The shape both react-devtools halves expect of a WebSocket. */
interface FakeSocket {
  OPEN: number;
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((error: unknown) => void) | null;
  send: (data: string) => void;
  close: () => void;
}

const status = ref<BridgeStatus>("idle");
const errorMessage = ref<string | null>(null);
const capability = ref<ReactCapabilityReport | null>(null);
const messagesFromTarget = ref(0);
const bytesFromTarget = ref(0);

let targetRuntimeSource: string | null = null;
let currentClient: CDPClient | null = null;
let currentTargetId: string | null = null;
let hostSocket: FakeSocket | null = null;
let pendingFromTarget: string[] = [];
let bindingCleanup: (() => void) | null = null;
let installedScriptIdentifier: string | null = null;
let startPromise: Promise<void> | null = null;
let currentIframe: HTMLIFrameElement | null = null;

function getTargetRuntimeSource() {
  targetRuntimeSource ??= buildTargetRuntimeSource();
  return targetRuntimeSource;
}

export function buildPanelHtml() {
  return buildFrameHtml(standaloneScriptUrl);
}

async function probeCapability(client: CDPClient) {
  const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
    expression: REACT_CAPABILITY_PROBE_EXPRESSION,
    returnByValue: true,
  });
  const value = (result.result as Record<string, unknown>).value;
  return interpretReactCapability(parseReactCapabilityProbe(value));
}

async function isRendererRegistered(client: CDPClient) {
  try {
    const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
      expression: REACT_RENDERER_REGISTRATION_EXPRESSION,
      returnByValue: true,
    });
    return (result.result as Record<string, unknown>).value === true;
  } catch {
    return false;
  }
}

async function waitForRenderer(client: CDPClient, timeoutMs: number) {
  const started = Date.now();
  do {
    if (await isRendererRegistered(client)) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  } while (Date.now() - started < timeoutMs);
  return false;
}

/** Host -> device. Sends the payload as an argument, never as script source. */
async function deliverToTarget(client: CDPClient, data: string) {
  try {
    await client.send("Runtime.evaluate", {
      expression: `(() => {
        const receive = globalThis[${JSON.stringify(TARGET_RECEIVE_NAME)}];
        if (typeof receive !== "function") return false;
        receive(${JSON.stringify(data)});
        return true;
      })()`,
      returnByValue: true,
    });
  } catch (error) {
    console.warn("React DevTools could not deliver a message to the target", error);
  }
}

function createHostSocket(client: CDPClient): FakeSocket {
  const socket: FakeSocket = {
    OPEN: 1,
    readyState: 1,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send(data: string) {
      void deliverToTarget(client, data);
    },
    close() {
      socket.readyState = 3;
      socket.onclose?.({ code: 1000 });
    },
  };
  return socket;
}

function attachBinding(client: CDPClient) {
  bindingCleanup?.();
  bindingCleanup = client.on("Runtime.bindingCalled", (event) => {
    const payload = event as { name?: string; payload?: string };
    if (payload.name !== TARGET_BINDING_NAME || typeof payload.payload !== "string") return;

    // Our own readiness ping is not part of the DevTools protocol.
    if (payload.payload.includes(TARGET_READY_FLAG)) return;

    messagesFromTarget.value += 1;
    bytesFromTarget.value += payload.payload.length;

    // The backend flushes its initial `operations` as soon as the renderer
    // mounts, which is before the UI has attached a listener. Dropping those
    // leaves the panel on "Loading React Element Tree..." forever, so hold them
    // until connectToSocket has wired onmessage, then replay in order.
    if (!hostSocket?.onmessage) {
      pendingFromTarget.push(payload.payload);
      return;
    }
    hostSocket.onmessage({ data: payload.payload });
  });
}

async function installTargetRuntime(client: CDPClient) {
  if (installedScriptIdentifier) {
    try {
      await client.send("Page.removeScriptToEvaluateOnNewDocument", {
        identifier: installedScriptIdentifier,
      });
    } catch (error) {
      // A stale identifier from a closed session is expected, not fatal.
      console.warn("React DevTools could not remove its previous boot script", error);
    }
    installedScriptIdentifier = null;
  }

  const installed = await client.send<{ identifier?: string }>(
    "Page.addScriptToEvaluateOnNewDocument",
    { source: getTargetRuntimeSource() },
  );
  installedScriptIdentifier = installed.identifier ?? null;
}

/** Bindings and the host socket, ready before the UI attaches. */
async function prepareTargetChannel(client: CDPClient, target: CDPTarget) {
  currentClient = client;
  currentTargetId = target.id;
  messagesFromTarget.value = 0;
  bytesFromTarget.value = 0;
  pendingFromTarget = [];

  await client.send("Runtime.enable", {});
  try {
    await client.send("Page.enable", {});
  } catch (error) {
    console.warn("React DevTools could not enable the Page domain", error);
  }
  try {
    await client.send("Runtime.addBinding", { name: TARGET_BINDING_NAME });
  } catch (error) {
    console.warn("React DevTools could not register the runtime binding", error);
  }

  hostSocket = createHostSocket(client);
  attachBinding(client);
}

/**
 * Injects the backend and reloads. Called only once the UI is connected, so the
 * backend's flushInitialOperations() lands on a listening frontend.
 */
async function bootTargetBackend(client: CDPClient) {
  await installTargetRuntime(client);

  status.value = "reloading";
  try {
    await client.send("Page.reload", { ignoreCache: false });
  } catch {
    await client.send("Runtime.evaluate", {
      expression: "(() => { location.reload(); return true; })()",
      returnByValue: true,
    });
  }

  const registered = await waitForRenderer(client, 20_000);
  if (!registered) {
    throw new Error("React did not register a renderer after reloading the target");
  }
}

function connectHostUi() {
  const frameWindow = currentIframe?.contentWindow as
    | (Window & {
        __capubridgeReactDevtoolsUI?: {
          setContentDOMNode: (node: unknown) => { connectToSocket: (s: FakeSocket) => void };
          connectToSocket: (s: FakeSocket) => void;
        };
      })
    | null;

  const ui = frameWindow?.__capubridgeReactDevtoolsUI;
  if (!ui || !hostSocket) return false;

  const mount = frameWindow?.document.getElementById("devtools");
  if (!mount) return false;

  const withNode = ui.setContentDOMNode(mount);
  (withNode ?? ui).connectToSocket(hostSocket);
  hostSocket.onopen?.();

  // Replay whatever the backend emitted before the UI had a listener.
  const queued = pendingFromTarget.splice(0, pendingFromTarget.length);
  for (const message of queued) {
    hostSocket.onmessage?.({ data: message });
  }
  return true;
}

async function waitForHostUi(timeoutMs: number) {
  const started = Date.now();
  do {
    const frameWindow = currentIframe?.contentWindow as
      | (Window & Record<string, unknown>)
      | null
      | undefined;
    if (frameWindow?.[HOST_READY_FLAG] === true) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  } while (Date.now() - started < timeoutMs);
  return false;
}

function statusLabelFor(value: BridgeStatus) {
  if (value === "probing") return "Checking the React runtime on the target";
  if (value === "booting") return "Injecting the React DevTools backend";
  if (value === "reloading") return "Reloading target so the backend hooks before react-dom";
  if (value === "connecting") return "Connecting the DevTools UI";
  if (value === "ready") return "React DevTools connected";
  if (value === "unsupported") return "React DevTools cannot attach to this target";
  if (value === "error") return "React DevTools failed to start";
  return "Waiting for React DevTools";
}

export function useReactDevtoolsBridge() {
  const cdp = useCDP();

  function attachIframe(iframe: HTMLIFrameElement | null) {
    currentIframe = iframe;
  }

  async function start(options?: { force?: boolean }) {
    if (startPromise) return startPromise;

    status.value = "probing";
    errorMessage.value = null;

    startPromise = (async () => {
      try {
        const target = cdp.targetsStore.selectedTarget;
        if (!target) throw new Error("Select a target before opening React DevTools");

        const client = cdp.activeClient.value ?? (await cdp.connectToTarget(target));

        const report = await probeCapability(client);
        capability.value = report;
        if (report.kind === "no-react" && !options?.force) {
          status.value = "unsupported";
          return;
        }

        // The UI must be listening before the backend runs, because the backend
        // calls flushInitialOperations() when *it* connects — at page load. That
        // is how the browser extension works too: devtools open, then the page
        // loads. Attaching afterwards means the element tree was already sent.
        status.value = "connecting";
        if (!(await waitForHostUi(15_000))) {
          throw new Error("The DevTools UI bundle did not finish loading");
        }

        status.value = "booting";
        await prepareTargetChannel(client, target);
        if (!connectHostUi()) {
          throw new Error("Could not connect the DevTools UI to the target");
        }
        await bootTargetBackend(client);

        capability.value = await probeCapability(client);
        status.value = "ready";
      } catch (error) {
        status.value = "error";
        errorMessage.value = error instanceof Error ? error.message : String(error);
      } finally {
        startPromise = null;
      }
    })();

    return startPromise;
  }

  function reset() {
    bindingCleanup?.();
    bindingCleanup = null;
    hostSocket?.close();
    hostSocket = null;
    currentClient = null;
    currentTargetId = null;
    status.value = "idle";
  }

  return {
    attachIframe,
    start,
    reset,
    panelHtml: buildPanelHtml(),
    status,
    errorMessage,
    capability,
    messagesFromTarget,
    bytesFromTarget,
    statusLabel: computed(() => statusLabelFor(status.value)),
    isReady: computed(() => status.value === "ready"),
    isBlocked: computed(() => status.value === "unsupported"),
    attachedTargetId: computed(() => currentTargetId),
    hasClient: computed(() => currentClient !== null),
  };
}
