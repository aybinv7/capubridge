import type {
  Bounds,
  IndexedControl,
  IndexedElement,
  Observation,
  SessionSignalState,
  SystemUiState,
} from "@/types/automation.types";

/** One node of the native hierarchy snapshot. Only the fields observation needs. */
export interface NativeHierarchyNode {
  className: string;
  packageName?: string;
  clickable?: boolean;
  focused?: boolean;
  bounds?: Bounds;
  children?: NativeHierarchyNode[];
}

/** Native layer snapshot handed to observe. Produced by the UIAutomator read. */
export interface NativeSnapshot {
  controls: IndexedControl[];
  packageName: string;
  activity: string;
  hierarchy: NativeHierarchyNode[];
  webViewBounds?: Bounds;
}

/** WebView layer snapshot handed to observe. Produced by the CDP read. */
export interface WebviewSnapshot {
  elements: IndexedElement[];
}

/** Viewport origin of the WebView on the device screen, in device pixels. */
export interface ViewportOffset {
  x: number;
  y: number;
}

/** Zeroed signals used when the signal read fails. Never fails the observation. */
export const EMPTY_SIGNALS: SessionSignalState = {
  pendingRequests: 0,
  recentErrors: [],
  lastDbWrite: null,
};

/**
 * External reads behind injection. The module never calls IPC or CDP
 * directly, so every test runs with fakes and no device.
 */
export interface ObservationReaders {
  readNative(): Promise<NativeSnapshot>;
  readWebview(native?: NativeSnapshot): Promise<WebviewSnapshot | null>;
  readSignals(): SessionSignalState;
  captureScreenshot(): Promise<string>;
}

/**
 * Assembles a fused Observation from the three layers. The native read starts
 * first so its WebView host bounds can ground the CDP layer. Degradation: a missing or failed WebView layer yields a null
 * webview and the run continues on native alone; a failed signal read yields
 * zeroed signals; a failed screenshot yields an empty ref. A failed native
 * read is fatal, because there is no automation without it.
 */
export async function observe(readers: ObservationReaders): Promise<Observation> {
  const nativeOutcome = await settle(() => readers.readNative());
  if (!nativeOutcome.ok) {
    throw new Error(
      `automation observation failed at the native layer: ${messageOf(nativeOutcome.error)}`,
    );
  }
  const webviewOutcome = settle(() => readers.readWebview(nativeOutcome.value));
  const screenshotOutcome = settle(() => readers.captureScreenshot());
  let signals: SessionSignalState;
  try {
    signals = readers.readSignals();
  } catch {
    signals = { ...EMPTY_SIGNALS, recentErrors: [] };
  }

  const [webview, screenshot] = await Promise.all([webviewOutcome, screenshotOutcome]);
  const observation: Observation = {
    native: {
      controls: nativeOutcome.value.controls,
      packageName: nativeOutcome.value.packageName,
      activity: nativeOutcome.value.activity,
      systemUi: deriveSystemUi(nativeOutcome.value.hierarchy),
      webViewBounds: nativeOutcome.value.webViewBounds,
    },
    webview: !webview.ok || webview.value === null ? null : { elements: webview.value.elements },
    signals,
    visual: { screenshotRef: screenshot.ok ? screenshot.value : "" },
  };
  observation.frameId = observationFingerprint(observation);
  return observation;
}

/**
 * Produces a stable semantic fingerprint for loop detection. Visual bytes and
 * screenshot references are deliberately excluded; volatile signal text is
 * bounded so one noisy log line cannot defeat no-progress detection.
 */
export function observationFingerprint(observation: Observation): string {
  const canonical = JSON.stringify({
    native: {
      packageName: observation.native.packageName,
      activity: observation.native.activity,
      systemUi: observation.native.systemUi,
      webViewBounds: observation.native.webViewBounds ?? null,
      controls: observation.native.controls.map((control) => ({
        index: control.index,
        bounds: roundBounds(control.bounds),
        className: control.className,
        text: control.text,
        contentDesc: control.contentDesc,
        clickable: control.clickable,
        enabled: control.enabled,
      })),
    },
    webview:
      observation.webview === null
        ? null
        : observation.webview.elements.map((element) => ({
            index: element.index,
            cssSelector: element.cssSelector,
            role: element.role,
            text: element.text,
            enabled: element.enabled,
            visible: element.visible,
            bounds: roundBounds(element.bounds),
            isInput: element.isInput,
            inputType: element.inputType,
            clickable: element.clickable ?? null,
          })),
    signals: {
      pendingRequests: observation.signals.pendingRequests,
      lastDbWrite: observation.signals.lastDbWrite,
    },
  });
  return `obs-${fnv1a(canonical)}`;
}

/**
 * Detects the soft keyboard and a native dialog from the hierarchy.
 * Heuristics: an input-method window or package marks the keyboard; a dialog,
 * modal, popup or alert window class marks a dialog. Tune against real
 * devices; class names vary by OEM and Android version.
 */
export function deriveSystemUi(hierarchy: NativeHierarchyNode[]): SystemUiState {
  let keyboardVisible = false;
  let dialogPresent = false;
  const visit = (nodes: NativeHierarchyNode[]): void => {
    for (const node of nodes) {
      const className = node.className.toLowerCase();
      const packageName = node.packageName?.toLowerCase() ?? "";
      if (className.includes("inputmethod") || packageName.includes("inputmethod")) {
        keyboardVisible = true;
      }
      if (
        className.includes("dialog") ||
        className.includes("modal") ||
        className.includes("popupwindow") ||
        className.includes("alertdialog")
      ) {
        dialogPresent = true;
      }
      if (node.children !== undefined) {
        visit(node.children);
      }
    }
  };
  visit(hierarchy);
  return { keyboardVisible, dialogPresent };
}

/**
 * Maps WebView CSS-pixel bounds to device-screen pixels through the viewport
 * offset and scale. A WebView element tapped through stale or unit-wrong
 * bounds misses, so this mapping is exact rather than approximate.
 */
export function toScreenBounds(
  webviewBounds: Bounds,
  viewportOffset: ViewportOffset,
  scale: number,
): Bounds {
  const [x, y, width, height] = webviewBounds;
  return [
    viewportOffset.x + x * scale,
    viewportOffset.y + y * scale,
    width * scale,
    height * scale,
  ];
}

/** Outcome of one injected read. */
type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * Invokes a reader immediately and converts both rejection and synchronous
 * throw into a settled outcome.
 */
function settle<T>(read: () => Promise<T>): Promise<Settled<T>> {
  try {
    return read().then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
  } catch (error) {
    return Promise.resolve({ ok: false as const, error });
  }
}

/**
 * Renders an unknown failure for an error message without throwing.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown error";
}

function roundBounds(bounds: Bounds): Bounds {
  return bounds.map((value) => Math.round(value * 100) / 100) as Bounds;
}

function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
