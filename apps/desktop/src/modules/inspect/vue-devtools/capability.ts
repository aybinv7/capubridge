/**
 * Capability probe for the Vue DevTools bridge.
 *
 * A Vue app is only inspectable when it was built with `__VUE_PROD_DEVTOOLS__`
 * enabled (always true for dev builds). With the flag off, Vue skips three
 * things at once: it never assigns `app._instance`, never emits `app:init` on
 * the global hook, and never attaches `__vnode` / `__vueParentComponent` to DOM
 * elements. Without any of those the official DevTools panel has nothing to
 * connect to and waits forever, so we probe before booting the bridge.
 */

export type VueCapabilityKind = "ready" | "no-vue" | "prod-devtools-disabled" | "unknown";

export interface VueCapabilityProbe {
  hasVueApp: boolean;
  vueVersion: string | null;
  hasDevtoolsHook: boolean;
  hookAppRecords: number;
  hasAppInstance: boolean;
  hasElementBackrefs: boolean;
}

export interface VueCapabilityReport {
  kind: VueCapabilityKind;
  title: string;
  detail: string;
  hint: string | null;
  probe: VueCapabilityProbe | null;
}

export const VUE_CAPABILITY_PROBE_EXPRESSION = String.raw`JSON.stringify((() => {
  const globalObject = typeof globalThis !== "undefined" ? globalThis : window;
  const hook = globalObject.__VUE_DEVTOOLS_GLOBAL_HOOK__;

  let vueApp = null;
  let hasElementBackrefs = false;

  const elements = document.querySelectorAll("*");
  const limit = Math.min(elements.length, 3000);
  for (let index = 0; index < limit; index += 1) {
    const element = elements[index];
    if (!vueApp && element.__vue_app__) vueApp = element.__vue_app__;
    if (!hasElementBackrefs && ("__vueParentComponent" in element || "__vnode" in element)) {
      hasElementBackrefs = true;
    }
    if (vueApp && hasElementBackrefs) break;
  }

  const hookApps = hook && Array.isArray(hook.apps) ? hook.apps.length : 0;
  const hookAppRecords = hook && Array.isArray(hook.appRecords) ? hook.appRecords.length : 0;

  return {
    hasVueApp: Boolean(vueApp) || Boolean(globalObject.__VUE__),
    vueVersion: vueApp && typeof vueApp.version === "string" ? vueApp.version : null,
    hasDevtoolsHook: Boolean(hook),
    hookAppRecords: Math.max(hookApps, hookAppRecords),
    hasAppInstance: Boolean(vueApp && vueApp._instance),
    hasElementBackrefs,
  };
})())`;

/**
 * Vue only adopts a DevTools hook that already exists when it boots, or one
 * that arrives inside its ~3s `__VUE_DEVTOOLS_HOOK_REPLAY__` window. Injecting
 * into a page that booted earlier leaves `enabled: false` and zero app records
 * forever, so this is what decides whether the target must be reloaded.
 */
export function isAppRegisteredOnHook(hook: unknown) {
  if (!hook || typeof hook !== "object") return false;
  const record = hook as { enabled?: unknown; apps?: unknown; appRecords?: unknown };
  const apps = Array.isArray(record.apps) ? record.apps.length : 0;
  const appRecords = Array.isArray(record.appRecords) ? record.appRecords.length : 0;
  return Boolean(record.enabled) && apps + appRecords > 0;
}

// Serialized from the function above so the target and the tests share one
// implementation instead of two copies that can drift apart.
export const VUE_APP_REGISTRATION_EXPRESSION =
  `(${isAppRegisteredOnHook.toString()})(` +
  `(typeof globalThis !== "undefined" ? globalThis : window).__VUE_DEVTOOLS_GLOBAL_HOOK__)`;

export function parseAppRegistration(value: unknown) {
  return value === true;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseVueCapabilityProbe(raw: unknown): VueCapabilityProbe | null {
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
  if (typeof record.hasVueApp !== "boolean") return null;

  return {
    hasVueApp: record.hasVueApp,
    vueVersion: typeof record.vueVersion === "string" ? record.vueVersion : null,
    hasDevtoolsHook: record.hasDevtoolsHook === true,
    hookAppRecords: toNumber(record.hookAppRecords),
    hasAppInstance: record.hasAppInstance === true,
    hasElementBackrefs: record.hasElementBackrefs === true,
  };
}

export function isVueIntrospectable(probe: VueCapabilityProbe) {
  return probe.hasAppInstance || probe.hasElementBackrefs || probe.hookAppRecords > 0;
}

export function interpretVueCapability(probe: VueCapabilityProbe | null): VueCapabilityReport {
  if (!probe) {
    return {
      kind: "unknown",
      title: "Could not read the Vue runtime",
      detail:
        "The capability probe returned no usable result. The target may have navigated or lost its execution context.",
      hint: "Re-check once the page has finished loading.",
      probe: null,
    };
  }

  if (!probe.hasVueApp && !probe.hasDevtoolsHook) {
    return {
      kind: "no-vue",
      title: "No Vue application on this target",
      detail: "No mounted Vue app was found in the current document.",
      hint: "Select the target that actually renders the Vue app, then re-check.",
      probe,
    };
  }

  if (isVueIntrospectable(probe)) {
    const version = probe.vueVersion ? ` ${probe.vueVersion}` : "";
    return {
      kind: "ready",
      title: `Vue${version} runtime is inspectable`,
      detail: "Component metadata is exposed; the DevTools bridge can attach.",
      hint: null,
      probe,
    };
  }

  const version = probe.vueVersion ? ` ${probe.vueVersion}` : "";
  return {
    kind: "prod-devtools-disabled",
    title: "This build has Vue DevTools stripped out",
    detail:
      `The target runs Vue${version} built for production with \`__VUE_PROD_DEVTOOLS__\` disabled. ` +
      "Vue therefore never registers the app on the DevTools hook, never keeps `app._instance`, and " +
      "attaches no `__vnode` / `__vueParentComponent` back-references to the DOM. There is no component " +
      "tree to read until the app is rebuilt.",
    hint: "In the target app's Vite config add `define: { __VUE_PROD_DEVTOOLS__: 'true' }` for staging builds, rebuild and reinstall.",
    probe,
  };
}
