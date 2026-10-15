import { invokeCommand } from "@/runtime/ipc/client";
import type { CDPClient } from "@capubridge/cdp-protocol";
import { useConnectionStore } from "@/stores/connection.store";
import { useConsoleStore } from "@/stores/console.store";
import { useTargetsStore } from "@/stores/targets.store";
import { readAutomationNetwork, readAutomationSignals } from "@/composables/useAutomationSignals";
import type { ConsoleProbe } from "./assertions";
import { evaluateAssertion } from "./assertions";
import { createDeviceActions } from "./deviceActions";
import { buildCandidates, resolveTarget } from "./elementIndex";
import type { ExecutorDeps } from "./flowExecutor";
import { observe } from "./observation";
import { accessibleName } from "./accessibleName";
import { resolveUnique, uniqueSelector } from "./uniqueSelector";
import type { NameSources } from "./accessibleName";
import { RECORDING_ENABLED } from "./runTrace";
import { parseUiAutomatorDump } from "./uiautomator";

export function createDesktopExecutorDeps(
  serial: string,
  installedPackages: string[] = [],
  appPackage = "",
): ExecutorDeps {
  return {
    deviceSerial: serial,
    installedPackages,
    appPackage,
    observe: () =>
      observe({
        readNative: () => readNativeSnapshot(serial),
        readWebview: (native) => readWebviewSnapshot(serial, native?.webViewBounds),
        readSignals: () => readAutomationSignals(serial, appPackage),
        captureScreenshot: () =>
          RECORDING_ENABLED
            ? invokeCommand("adb_mirror_screenshot", { serial }).catch(() => "")
            : Promise.resolve(""),
      }),
    actions: createDeviceActions(),
    readSignals: () => readAutomationSignals(serial, appPackage),
    resolveTarget,
    buildCandidates,
    evaluateAssertion,
    evidence: {
      queryDom: (selector) => queryDom(serial, selector),
      currentUrl: () => readCurrentUrl(serial),
      dbRow: (query) => readDbRow(serial, query.database, query.store, query.key),
      recentNetwork: () => Promise.resolve(readAutomationNetwork()),
      recentConsole: () => Promise.resolve(readConsoleProbes()),
    },
    readbackText: (target, observation) => readbackText(serial, target, observation),
    writeText: (target, text) => writeWebviewText(serial, target, text),
    clickWebview: (target) => clickWebview(serial, target),
  };
}

/**
 * Reads the native layer through the shared ADB shell. No new process and
 * no mirror session required.
 *
 * Dumps to a file rather than piping to `/dev/stdout`: on a real range of
 * devices `uiautomator dump /dev/stdout` prints only its own confirmation
 * line and no XML, which `parseUiAutomatorDump` correctly rejects as
 * malformed on every call. `/data/local/tmp` is shell-writable with no
 * external-storage permission dependency. The file is removed after the
 * read so concurrent runs on the same device do not race on it.
 */
async function readNativeSnapshot(serial: string) {
  let lastError: unknown = new Error("uiautomator dump produced no XML");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const dumpPath = `/data/local/tmp/capubridge_ui_dump_${Date.now()}_${attempt}.xml`;
    try {
      const output = await invokeCommand("adb_shell_command", {
        serial,
        command: `uiautomator dump --compressed ${dumpPath}; cat ${dumpPath}; rm -f ${dumpPath}`,
      });
      return parseUiAutomatorDump(output);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function readConsoleProbes(): ConsoleProbe[] {
  const consoleStore = useConsoleStore();
  return consoleStore.entries.map((entry) => ({ level: entry.level, text: entry.message }));
}

async function getCdpClient(serial: string): Promise<CDPClient | null> {
  const targetsStore = useTargetsStore();
  const connectionStore = useConnectionStore();
  let target =
    (targetsStore.selectedTarget?.deviceSerial === serial ? targetsStore.selectedTarget : null) ??
    targetsStore.targets.find((entry) => entry.source === "adb" && entry.deviceSerial === serial) ??
    null;
  if (target === null) {
    await targetsStore.hydrateAdbTargets(serial);
    target =
      (targetsStore.selectedTarget?.deviceSerial === serial ? targetsStore.selectedTarget : null) ??
      targetsStore.targets.find(
        (entry) => entry.source === "adb" && entry.deviceSerial === serial,
      ) ??
      null;
  }
  if (target === null || target.webSocketDebuggerUrl === undefined) {
    return null;
  }
  return connectionStore.getClient(target.id) ?? connectionStore.connect(target);
}

async function evaluateValue<T>(client: CDPClient, expression: string): Promise<T | null> {
  const result = await client.send<{ result?: { value?: unknown } }>("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  const value = result.result?.value;
  return value === undefined ? null : (value as T);
}

async function readWebviewSnapshot(serial: string, hostBounds?: [number, number, number, number]) {
  const client = await getCdpClient(serial);
  if (client === null) {
    return null;
  }
  const value = await evaluateValue<{
    viewport: { width: number; height: number; offsetX: number; offsetY: number };
    elements: Array<{
      cssSelector: string;
      role: string;
      text: string;
      enabled: boolean;
      visible: boolean;
      bounds: [number, number, number, number];
      isInput: boolean;
      inputType: string | null;
      clickable: boolean;
      nameSources: NameSources;
    }>;
  }>(
    client,
    `(() => {
      const selector = ${uniqueSelector.toString()};
      return {
        viewport: {
          width: window.visualViewport?.width || window.innerWidth,
          height: window.visualViewport?.height || window.innerHeight,
          offsetX: window.visualViewport?.offsetLeft || 0,
          offsetY: window.visualViewport?.offsetTop || 0
        },
        elements: [...document.querySelectorAll('button,input,textarea,select,a,[role],[data-testid],[contenteditable="true"],[onclick]')].map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const tag = element.tagName.toLowerCase();
          const role = element.getAttribute('role') || tag;
          const isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || (element instanceof HTMLElement && element.isContentEditable);
          const clickable = ['button', 'input', 'textarea', 'select', 'a'].includes(tag) || role === 'button' || role === 'link' || element.hasAttribute('onclick');
          const labelledBy = (element.getAttribute('aria-labelledby') || '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
          return {
            cssSelector: selector(element),
            role,
            text: isInput ? '' : (element.textContent || '').trim().slice(0, 500),
            enabled: !element.hasAttribute('disabled') && !element.getAttribute('aria-disabled'),
            visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
            bounds: [rect.left, rect.top, rect.width, rect.height],
            isInput,
            inputType: element instanceof HTMLInputElement ? element.type : null,
            clickable,
            nameSources: {
              ariaLabel: element.getAttribute('aria-label'),
              labelledBy: labelledBy === '' ? null : labelledBy,
              title: element.getAttribute('title'),
              svgTitle: element.querySelector('svg title')?.textContent || null,
              placeholder: element.getAttribute('placeholder'),
              href: tag === 'a' ? element.getAttribute('href') : null
            }
          };
        }).slice(0, 500)
      };
    })()`,
  );
  if (value === null) {
    return null;
  }
  const screen =
    hostBounds === undefined
      ? await invokeCommand("adb_mirror_get_screen_size", { serial }).catch(() => null)
      : null;
  const host =
    hostBounds ??
    (screen === null
      ? null
      : ([0, 0, screen.width, screen.height] as [number, number, number, number]));
  const widthScale = host !== null && value.viewport.width > 0 ? host[2] / value.viewport.width : 1;
  const heightScale =
    host !== null && value.viewport.height > 0 ? host[3] / value.viewport.height : 1;
  return {
    elements: value.elements.map(({ nameSources, ...element }, index) => {
      const [x, y, width, height] = element.bounds;
      return {
        ...element,
        name: accessibleName(nameSources),
        index,
        bounds: [
          (host?.[0] ?? 0) + (value.viewport.offsetX + x) * widthScale,
          (host?.[1] ?? 0) + (value.viewport.offsetY + y) * heightScale,
          width * widthScale,
          height * heightScale,
        ] as [number, number, number, number],
        clickable: element.clickable,
      };
    }),
  };
}

async function queryDom(serial: string, selector: string) {
  const client = await getCdpClient(serial);
  if (client === null) {
    throw new Error("no connected WebView target");
  }
  return evaluateValue<{ text: string; visible: boolean } | null>(
    client,
    `(() => {
      const element = (${resolveUnique.toString()})(document, ${JSON.stringify(selector)});
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        text: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : (element.textContent || '').trim(),
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      };
    })()`,
  );
}

async function readCurrentUrl(serial: string): Promise<string> {
  const client = await getCdpClient(serial);
  if (client === null) {
    return "";
  }
  return (await evaluateValue<string>(client, "location.href")) ?? "";
}

async function readDbRow(
  serial: string,
  database: string,
  store: string,
  key: string,
): Promise<unknown> {
  const client = await getCdpClient(serial);
  if (client === null) {
    throw new Error("no connected WebView target");
  }
  return evaluateValue(
    client,
    `(async () => {
      const request = indexedDB.open(${JSON.stringify(database)});
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('indexedDB open failed'));
      });
      const value = await new Promise((resolve, reject) => {
        const get = db.transaction(${JSON.stringify(store)}, 'readonly').objectStore(${JSON.stringify(store)}).get(${JSON.stringify(key)});
        get.onsuccess = () => resolve(get.result === undefined ? null : get.result);
        get.onerror = () => reject(get.error || new Error('indexedDB read failed'));
      });
      db.close();
      return value;
    })()`,
  );
}

/**
 * Reads a typed value back after a type step. A WebView input is always read
 * live over CDP, never from the observation: the extractor blanks input text
 * so typed values stay out of observations, fingerprints and traces, which
 * made an observation-based readback report "" for every input.
 */
async function readbackText(
  serial: string,
  target: import("@/types/automation.types").TargetRef,
  observation?: import("@/types/automation.types").Observation,
) {
  if (target.kind === "nativeIndex") {
    return (
      observation?.native.controls.find((control) => control.index === target.index)?.text ?? null
    );
  }
  if (target.kind !== "selector") return null;
  const client = await getCdpClient(serial);
  if (client === null) {
    return null;
  }
  return evaluateValue<string | null>(
    client,
    `(() => {
      const element = (${resolveUnique.toString()})(document, ${JSON.stringify(target.cssSelector)});
      if (!element) return null;
      return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : element.textContent || '';
    })()`,
  );
}

async function writeWebviewText(
  serial: string,
  target: import("@/types/automation.types").TargetRef,
  text: string,
): Promise<boolean> {
  if (target.kind !== "selector") {
    return false;
  }
  const client = await getCdpClient(serial);
  if (client === null) {
    return false;
  }
  return (
    (await evaluateValue<boolean>(
      client,
      `(() => {
        const element = (${resolveUnique.toString()})(document, ${JSON.stringify(target.cssSelector)});
        if (!element) return false;
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const prototype = Object.getPrototypeOf(element);
          const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
          if (descriptor?.set) descriptor.set.call(element, ${JSON.stringify(text)});
          else element.value = ${JSON.stringify(text)};
        } else if (element instanceof HTMLElement && element.isContentEditable) {
          element.textContent = ${JSON.stringify(text)};
        } else {
          return false;
        }
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        return true;
      })()`,
    )) ?? false
  );
}

async function clickWebview(
  serial: string,
  target: import("@/types/automation.types").TargetRef,
): Promise<boolean> {
  if (target.kind !== "selector") {
    return false;
  }
  const client = await getCdpClient(serial);
  if (client === null) {
    return false;
  }
  return (
    (await evaluateValue<boolean>(
      client,
      `(() => {
        const element = (${resolveUnique.toString()})(document, ${JSON.stringify(target.cssSelector)});
        if (!(element instanceof HTMLElement)) return false;
        element.focus();
        element.click();
        return true;
      })()`,
    )) ?? false
  );
}
