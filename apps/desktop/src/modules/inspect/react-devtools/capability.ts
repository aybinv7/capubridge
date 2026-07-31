/**
 * Capability probe for the React DevTools bridge.
 *
 * React differs from Vue in a way that matters here: `react-dom` keeps fiber
 * back-references on DOM nodes and calls `__REACT_DEVTOOLS_GLOBAL_HOOK__` in
 * production too, so there is no `__VUE_PROD_DEVTOOLS__` equivalent to switch
 * on. A production build is still fully inspectable — only the component names
 * are minified.
 *
 * What React *does* share with Vue is the boot race: `react-dom` reads the
 * global hook once, as it loads. A hook injected into an already-running page
 * is never picked up, so `renderers` stays empty and the backend has nothing to
 * attach to. That is what decides whether the target must be reloaded.
 */

export type ReactCapabilityKind = "ready" | "hook-missed-boot" | "no-react" | "unknown";

export interface ReactCapabilityProbe {
  hasFibers: boolean;
  hasHook: boolean;
  rendererCount: number;
  reactVersion: string | null;
  /** `bundleType === 1` means a development build, so names are not minified. */
  isDevelopmentBuild: boolean;
  backendAlreadyAttached: boolean;
}

export interface ReactCapabilityReport {
  kind: ReactCapabilityKind;
  title: string;
  detail: string;
  hint: string | null;
  probe: ReactCapabilityProbe | null;
}

/** React 17+ uses `__reactFiber$`; 16 used `__reactInternalInstance$`. */
export const REACT_FIBER_KEY_PATTERN =
  /^(__reactFiber\$|__reactContainer\$|__reactInternalInstance\$|_reactRootContainer)/;

export const REACT_CAPABILITY_PROBE_EXPRESSION = String.raw`JSON.stringify((() => {
  const globalObject = typeof globalThis !== "undefined" ? globalThis : window;
  const hook = globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  const fiberKey = /^(__reactFiber\$|__reactContainer\$|__reactInternalInstance\$|_reactRootContainer)/;
  let hasFibers = false;
  const elements = document.querySelectorAll("*");
  const limit = Math.min(elements.length, 3000);
  for (let index = 0; index < limit && !hasFibers; index += 1) {
    const keys = Object.keys(elements[index]);
    for (let k = 0; k < keys.length; k += 1) {
      if (fiberKey.test(keys[k])) { hasFibers = true; break; }
    }
  }

  let rendererCount = 0;
  let reactVersion = null;
  let isDevelopmentBuild = false;
  if (hook && hook.renderers && typeof hook.renderers.forEach === "function") {
    hook.renderers.forEach((renderer) => {
      rendererCount += 1;
      if (!reactVersion && renderer && typeof renderer.version === "string") {
        reactVersion = renderer.version;
      }
      if (renderer && renderer.bundleType === 1) isDevelopmentBuild = true;
    });
  }

  return {
    hasFibers,
    hasHook: Boolean(hook),
    rendererCount,
    reactVersion,
    isDevelopmentBuild,
    backendAlreadyAttached: Boolean(hook && hook.reactDevtoolsAgent),
  };
})())`;

/**
 * True once `react-dom` has registered against our hook. Mirrors the Vue
 * bridge's registration check: a live transport is not a usable session.
 */
export function isReactRendererRegistered(hook: unknown) {
  if (!hook || typeof hook !== "object") return false;
  const renderers = (hook as { renderers?: unknown }).renderers;
  if (!renderers) return false;
  const size = (renderers as { size?: unknown }).size;
  return typeof size === "number" && size > 0;
}

export const REACT_RENDERER_REGISTRATION_EXPRESSION =
  `(${isReactRendererRegistered.toString()})(` +
  `(typeof globalThis !== "undefined" ? globalThis : window).__REACT_DEVTOOLS_GLOBAL_HOOK__)`;

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseReactCapabilityProbe(raw: unknown): ReactCapabilityProbe | null {
  let source: unknown = raw;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return null;
    }
  }

  if (typeof source !== "object" || source === null) return null;

  const record = source as Record<string, unknown>;
  if (typeof record.hasFibers !== "boolean") return null;

  return {
    hasFibers: record.hasFibers,
    hasHook: record.hasHook === true,
    rendererCount: toNumber(record.rendererCount),
    reactVersion: typeof record.reactVersion === "string" ? record.reactVersion : null,
    isDevelopmentBuild: record.isDevelopmentBuild === true,
    backendAlreadyAttached: record.backendAlreadyAttached === true,
  };
}

export function interpretReactCapability(
  probe: ReactCapabilityProbe | null,
): ReactCapabilityReport {
  if (!probe) {
    return {
      kind: "unknown",
      title: "Could not read the React runtime",
      detail:
        "The capability probe returned no usable result. The target may have navigated or lost its execution context.",
      hint: "Re-check once the page has finished loading.",
      probe: null,
    };
  }

  if (!probe.hasFibers && !probe.hasHook) {
    return {
      kind: "no-react",
      title: "No React application on this target",
      detail: "No React fiber roots were found in the current document.",
      hint: "Select the target that actually renders the React app, then re-check.",
      probe,
    };
  }

  const version = probe.reactVersion ? ` ${probe.reactVersion}` : "";

  if (probe.rendererCount > 0) {
    return {
      kind: "ready",
      title: `React${version} runtime is inspectable`,
      detail: "react-dom registered against the DevTools hook; the backend can attach.",
      // bundleType is only observable once a renderer registered, so this is the
      // only branch that may claim anything about the build.
      hint: probe.isDevelopmentBuild
        ? null
        : "This is a production build, so component names are minified. Run the app with a dev server for readable names.",
      probe,
    };
  }

  return {
    kind: "hook-missed-boot",
    title: probe.hasHook
      ? "React booted before the DevTools hook"
      : "No DevTools hook installed yet",
    detail: probe.hasHook
      ? "React fibers are present and the hook exists, but no renderer registered against it — react-dom loaded first. " +
        "The target has to reload with the backend installed at document start."
      : "React fibers are present but nothing has installed the DevTools hook. The backend will install it at " +
        "document start and reload the target, because react-dom reads the hook once as it loads.",
    hint: null,
    probe,
  };
}

/**
 * `bundleType` lives on registered renderers, so the build is genuinely unknown
 * until one registers. Never presented as "production" on absent evidence.
 */
export function describeReactBuild(probe: ReactCapabilityProbe) {
  if (probe.rendererCount === 0) return "unknown";
  return probe.isDevelopmentBuild ? "development" : "production";
}
