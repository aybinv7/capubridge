import { ref } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import type { CDPTarget } from "@/types/cdp.types";
import type { ConnectionSource } from "@/types/connection.types";
import type { WebViewSocket } from "@/types/adb.types";

interface RawCDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
  faviconUrl?: string;
  packageName?: string;
}

export const useTargetsStore = defineStore("targets", () => {
  const targets = ref<CDPTarget[]>([]);
  const selectedTarget = ref<CDPTarget | null>(null);
  const fetchingSources = ref<Set<string>>(new Set());
  const error = ref<string | null>(null);

  function isSameTargetSignature(a: CDPTarget, b: CDPTarget) {
    if (a.source !== b.source) return false;
    if ((a.deviceSerial ?? null) !== (b.deviceSerial ?? null)) return false;
    if (a.url && b.url) return a.url === b.url;
    return a.title === b.title && (a.packageName ?? "") === (b.packageName ?? "");
  }

  async function fetchTargetsForSource(source: ConnectionSource) {
    const key = source.type === "adb" ? `adb:${source.serial}` : `chrome:${source.port}`;
    if (fetchingSources.value.has(key)) return;

    fetchingSources.value.add(key);
    error.value = null;

    try {
      let raw: RawCDPTarget[] = [];

      if (source.type === "chrome") {
        raw = await invoke<RawCDPTarget[]>("chrome_fetch_targets", {
          port: source.port,
        });
      } else {
        // Enumerate all debuggable WebView sockets on the device and collect targets from each.
        // Each socket is forwarded to a dynamically allocated local port to avoid collisions.
        let sockets: WebViewSocket[] = [];
        try {
          sockets = await invoke<WebViewSocket[]>("adb_list_webview_sockets", {
            serial: source.serial,
          });
        } catch {
          // socket enumeration failed — continue with chrome_devtools_remote only
        }

        // Always probe chrome_devtools_remote too (Chrome browser tabs)
        // Deduplicate socket names and skip Stetho sockets (they don't serve CDP /json)
        const uniqueSocketNames = [
          "chrome_devtools_remote",
          ...sockets.map((s) => s.socketName).filter((name) => !name.startsWith("stetho_")),
        ].filter((name, i, arr) => arr.indexOf(name) === i);

        for (const socketName of uniqueSocketNames) {
          try {
            const port = await invoke<number>("adb_forward_cdp", {
              serial: source.serial,
              socketName,
            });

            const pkg = sockets.find((s) => s.socketName === socketName)?.packageName ?? "unknown";

            // Try to fetch /json from this socket.
            // Only chrome_devtools_remote and some WebView sockets serve HTTP /json.
            // For WebSocket-only sockets, we'll create synthetic targets.
            let socketTargets: RawCDPTarget[] = [];
            try {
              socketTargets = await invoke<RawCDPTarget[]>("adb_fetch_json_targets", { port });
            } catch {
              // This socket doesn't serve /json — create a synthetic target
              const wsUrl = `ws://127.0.0.1:${port}/`;
              socketTargets.push({
                id: `adb:${source.serial}:${socketName}`,
                type: "page",
                title: `${socketName} (${pkg})`,
                url: "",
                webSocketDebuggerUrl: wsUrl,
              });
            }

            socketTargets.forEach((t) => (t.packageName = pkg));
            raw.push(...socketTargets);
          } catch {
            // forward failed for this socket — skip it
          }
        }
      }

      const enriched = raw.map((t) => ({
        id: t.id,
        type: (t.type as CDPTarget["type"]) || "page",
        title: t.title,
        url: t.url,
        webSocketDebuggerUrl: t.webSocketDebuggerUrl,
        source: source.type as "adb" | "chrome",
        deviceSerial: source.type === "adb" ? source.serial : undefined,
        faviconUrl: t.faviconUrl,
        packageName: t.packageName,
      }));

      // Key by deviceSerial for ADB (not source.type) so each device owns its slice of targets.
      if (source.type === "adb") {
        targets.value = targets.value
          .filter((t) => t.deviceSerial !== source.serial)
          .concat(enriched);
      } else {
        targets.value = targets.value.filter((t) => t.source !== source.type).concat(enriched);
      }

      const currentSelected = selectedTarget.value;
      if (currentSelected) {
        const replacement =
          targets.value.find((t) => t.id === currentSelected.id) ??
          targets.value.find((t) => isSameTargetSignature(currentSelected, t));
        if (replacement) {
          selectedTarget.value = replacement;
        }
      }
    } catch (err) {
      error.value = String(err);
    } finally {
      fetchingSources.value.delete(key);
    }
  }

  function selectTarget(target: CDPTarget | null) {
    selectedTarget.value = target;
  }

  function clearTargetsForSerial(serial: string) {
    targets.value = targets.value.filter((t) => t.deviceSerial !== serial);
    if (selectedTarget.value?.deviceSerial === serial) {
      selectedTarget.value = null;
    }
  }

  function clearAllTargets() {
    targets.value = [];
    selectedTarget.value = null;
  }

  return {
    targets,
    selectedTarget,
    fetchingSources,
    error,
    fetchTargetsForSource,
    selectTarget,
    clearTargetsForSerial,
    clearAllTargets,
  };
});
