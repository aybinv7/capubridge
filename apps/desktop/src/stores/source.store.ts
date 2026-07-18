import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { ChromeSource, ConnectionSource } from "@/types/connection.types";
import { CHROME_CDP_PORT } from "@/config/ports";
import { useSessionStore } from "@/stores/session.store";
import { invokeCommand } from "@/runtime/ipc/client";

export const useSourceStore = defineStore("source", () => {
  const sessionStore = useSessionStore();
  const chromeSource = ref<ChromeSource | null>(null);
  const chromeStatus = ref<"idle" | "checking" | "launching" | "running" | "error">("idle");
  const chromeError = ref<string | null>(null);
  const chromeNeedsRelaunch = ref(false);

  const adbSource = computed(() => {
    const device = sessionStore.selectedDevice;
    if (!device || device.status !== "online") {
      return null;
    }

    return {
      type: "adb" as const,
      serial: device.serial,
    };
  });

  const activeSources = computed(() => {
    const sources: ConnectionSource[] = [];
    if (adbSource.value) {
      sources.push(adbSource.value);
    }
    if (chromeSource.value) {
      sources.push(chromeSource.value);
    }
    return sources;
  });

  const hasAdbSource = computed(() => adbSource.value !== null);
  const hasChromeSource = computed(() => chromeSource.value !== null);

  function getAdbSource() {
    return adbSource.value;
  }

  function getChromeSource() {
    return chromeSource.value;
  }

  async function autoConnectChrome() {
    chromeStatus.value = "checking";
    chromeError.value = null;
    chromeNeedsRelaunch.value = false;

    try {
      const res = await invokeCommand("chrome_verify_port", {
        port: CHROME_CDP_PORT,
      });
      if (res) {
        chromeSource.value = {
          type: "chrome",
          port: CHROME_CDP_PORT,
          mode: "auto",
        };
        chromeStatus.value = "running";
        return "connected";
      }
    } catch (error) {
      console.info("Chrome CDP port unavailable during auto-connect", error);
    }

    try {
      const isRunning = await invokeCommand("chrome_is_running");
      if (isRunning) {
        chromeNeedsRelaunch.value = true;
        chromeStatus.value = "idle";
        return "needs_relaunch";
      }
    } catch {
      // command unavailable (binary not yet rebuilt) — treat as not found
      chromeStatus.value = "idle";
    }

    chromeStatus.value = "idle";
    return "not_found";
  }

  async function launchChrome() {
    chromeStatus.value = "launching";
    chromeError.value = null;

    try {
      try {
        const isRunning = await invokeCommand("chrome_is_running");
        if (isRunning) {
          await invokeCommand("chrome_kill_all");
          // Poll until all Chrome processes are gone (max 6s)
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 200));
            const stillRunning = await invokeCommand("chrome_is_running");
            if (!stillRunning) break;
          }
        }
      } catch (error) {
        console.warn("Failed to check Chrome process state before launch", error);
      }

      const result = await invokeCommand("chrome_launch", {
        port: CHROME_CDP_PORT,
      });

      chromeSource.value = {
        type: "chrome",
        port: CHROME_CDP_PORT,
        mode: "auto",
        pid: result.pid,
      };

      chromeStatus.value = "running";
      chromeNeedsRelaunch.value = false;
      return true;
    } catch (err) {
      chromeStatus.value = "error";
      chromeError.value = String(err);
      return false;
    }
  }

  async function connectChrome(port: number) {
    chromeStatus.value = "launching";
    chromeError.value = null;

    try {
      const verified = await invokeCommand("chrome_verify_port", { port });
      if (!verified) throw new Error(`Nothing is listening on Chrome debugging port ${port}`);

      chromeSource.value = {
        type: "chrome",
        port,
        mode: "manual",
      };

      chromeStatus.value = "running";
      return true;
    } catch {
      chromeStatus.value = "error";
      chromeError.value = `Cannot connect to Chrome on port ${port}. Make sure Chrome is running with --remote-debugging-port=${port} --remote-allow-origins=*`;
      return false;
    }
  }

  async function disconnectChrome() {
    const source = getChromeSource();
    if (!source) return;

    chromeSource.value = null;
    chromeStatus.value = "idle";
    chromeError.value = null;
    chromeNeedsRelaunch.value = false;
  }

  function clearError() {
    chromeError.value = null;
    if (chromeStatus.value === "error") {
      chromeStatus.value = "idle";
    }
  }

  return {
    activeSources,
    chromeStatus,
    chromeError,
    chromeNeedsRelaunch,
    hasAdbSource,
    hasChromeSource,
    getAdbSource,
    getChromeSource,
    autoConnectChrome,
    launchChrome,
    connectChrome,
    disconnectChrome,
    clearError,
  };
});
