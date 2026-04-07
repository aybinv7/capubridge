import { ref } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import type { CDPTarget } from "@/types/cdp.types";
import type { ConnectionSource } from "@/types/connection.types";
import type { WebViewSocket } from "@/types/adb.types";
import { CHROME_CDP_PORT } from "@/config/ports";

interface RawCDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
  faviconUrl?: string;
}

export const useTargetsStore = defineStore("targets", () => {
  const targets = ref<CDPTarget[]>([]);
  const selectedTarget = ref<CDPTarget | null>(null);
  const fetchingSources = ref<Set<string>>(new Set());
  const error = ref<string | null>(null);

  async function fetchTargetsForSource(source: ConnectionSource) {
    const key = source.type === "adb" ? `adb:${source.serial}` : `chrome:${source.port}`;
    fetchingSources.value.add(key);
    error.value = null;

    console.log("[targets] fetchTargetsForSource", source);
    console.log("[targets] source type:", source.type);

    try {
      let raw: RawCDPTarget[] = [];

      if (source.type === "chrome") {
        raw = await invoke<RawCDPTarget[]>("chrome_fetch_targets", { port: source.port });
      } else {
        console.log("[targets] Fetching for ADB, serial:", source.serial);
        
        // Enumerate all debuggable WebView sockets on the device and collect targets from each.
        // Each socket is forwarded to its own local port so WebSocket URLs remain valid
        // for the duration of the session.
        let sockets: WebViewSocket[] = [];
        try {
          sockets = await invoke<WebViewSocket[]>("adb_list_webview_sockets", {
            serial: source.serial,
          });
          console.log("[targets] WebView sockets found:", sockets);
        } catch (e) {
          console.error("[targets] adb_list_webview_sockets error:", e);
        }

        // Always probe chrome_devtools_remote too (Chrome browser tabs)
        // Deduplicate socket names and skip Stetho sockets (they don't serve CDP /json)
        const uniqueSocketNames = [
          "chrome_devtools_remote",
          ...sockets
            .map((s) => s.socketName)
            .filter((name) => !name.startsWith("stetho_")),
        ].filter((name, i, arr) => arr.indexOf(name) === i);
        console.log("[targets] Unique socket names to probe:", uniqueSocketNames);

        let port = source.port; // starts at ADB_CDP_PORT (9222)
        console.log("[targets] Starting port:", port);

        for (const socketName of uniqueSocketNames) {
          if (port === CHROME_CDP_PORT) port++; // never clash with desktop Chrome port
          try {
            console.log("[targets] Forwarding:", socketName, "to port:", port);
            await invoke("adb_forward_cdp", {
              serial: source.serial,
              localPort: port,
              socketName,
            });
            console.log("[targets] Fetching /json from port:", port, "via Rust");
            const targets: RawCDPTarget[] = await invoke<RawCDPTarget[]>(
              "adb_fetch_json_targets",
              { port }
            );
            console.log("[targets] Targets found:", targets.length, targets);
            raw.push(...targets);
          } catch (e) {
            console.warn("[targets] Port", port, "failed:", e);
          }
          port++;
        }
      }

      const enriched = raw
        .filter((t) => ["page", "background_page", "iframe"].includes(t.type))
        .map((t) => ({
          id: t.id,
          type: t.type as CDPTarget["type"],
          title: t.title,
          url: t.url,
          webSocketDebuggerUrl: t.webSocketDebuggerUrl,
          source: source.type as "adb" | "chrome",
          deviceSerial: source.type === "adb" ? source.serial : undefined,
          faviconUrl: t.faviconUrl,
        }));

      targets.value = targets.value.filter((t) => t.source !== source.type).concat(enriched);
    } catch (err) {
      error.value = String(err);
    } finally {
      fetchingSources.value.delete(key);
    }
  }

  function selectTarget(target: CDPTarget) {
    selectedTarget.value = target;
  }

  function clearTargetsForSource(sourceType: "adb" | "chrome") {
    targets.value = targets.value.filter((t) => t.source !== sourceType);
    if (selectedTarget.value?.source === sourceType) {
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
    clearTargetsForSource,
    clearAllTargets,
  };
});
