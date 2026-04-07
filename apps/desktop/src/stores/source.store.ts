import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionSource, ChromeLaunchResult } from "@/types/connection.types";
import { ADB_CDP_PORT, CHROME_CDP_PORT } from "@/config/ports";

export const useSourceStore = defineStore("source", () => {
  const activeSources = ref<ConnectionSource[]>([]);
  const chromeStatus = ref<"idle" | "checking" | "launching" | "running" | "error">("idle");
  const chromeError = ref<string | null>(null);
  const chromeNeedsRelaunch = ref(false);

  const hasAdbSource = computed(() => activeSources.value.some((s) => s.type === "adb"));
  const hasChromeSource = computed(() => activeSources.value.some((s) => s.type === "chrome"));

  function getAdbSource() {
    return activeSources.value.find((s) => s.type === "adb") ?? null;
  }

  function getChromeSource() {
    return activeSources.value.find((s) => s.type === "chrome") ?? null;
  }

  async function addAdbSource(serial: string) {
    const existing = getAdbSource();
    if (existing && existing.serial === serial) return;

    if (existing) {
      await removeAdbSource();
    }

    await invoke("adb_forward_cdp", { serial, localPort: ADB_CDP_PORT });

    activeSources.value.push({
      type: "adb",
      serial,
      port: ADB_CDP_PORT,
    });
  }

  async function removeAdbSource() {
    const source = getAdbSource();
    if (!source) return;

    try {
      await invoke("adb_remove_forward", {
        serial: source.serial,
        localPort: source.port,
      });
    } catch {
      // ignore cleanup errors
    }

    activeSources.value = activeSources.value.filter((s) => s.type !== "adb");
  }

  async function autoConnectChrome() {
    chromeStatus.value = "checking";
    chromeError.value = null;
    chromeNeedsRelaunch.value = false;

    try {
      const res = await invoke<boolean>("chrome_verify_port", {
        port: CHROME_CDP_PORT,
      });
      if (res) {
        activeSources.value.push({
          type: "chrome",
          port: CHROME_CDP_PORT,
          mode: "auto",
        });
        chromeStatus.value = "running";
        return "connected";
      }
    } catch {
      // port not listening, continue
    }

    try {
      const isRunning = await invoke<boolean>("chrome_is_running");
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
        const isRunning = await invoke<boolean>("chrome_is_running");
        if (isRunning) {
          await invoke("chrome_kill_all");
          // Poll until all Chrome processes are gone (max 6s)
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 200));
            const stillRunning = await invoke<boolean>("chrome_is_running");
            if (!stillRunning) break;
          }
        }
      } catch {
        // chrome_is_running unavailable — binary needs rebuild, skip pre-kill
      }

      const result = await invoke<ChromeLaunchResult>("chrome_launch", {
        port: CHROME_CDP_PORT,
      });

      activeSources.value.push({
        type: "chrome",
        port: CHROME_CDP_PORT,
        mode: "auto",
        pid: result.pid,
      });

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
      await invoke("chrome_verify_port", { port });

      const existing = getChromeSource();
      if (existing) {
        activeSources.value = activeSources.value.filter((s) => s.type !== "chrome");
      }

      activeSources.value.push({
        type: "chrome",
        port,
        mode: "manual",
      });

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

    activeSources.value = activeSources.value.filter((s) => s.type !== "chrome");
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
    addAdbSource,
    removeAdbSource,
    autoConnectChrome,
    launchChrome,
    connectChrome,
    disconnectChrome,
    clearError,
  };
});
