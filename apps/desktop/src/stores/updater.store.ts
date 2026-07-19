import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import type { UpdateInfo, UpdateStatus } from "@/types/updater.types";

const LS_PRERELEASE = "capubridge:update-prerelease";
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export const useUpdaterStore = defineStore("updater", () => {
  const status = ref<UpdateStatus>("idle");
  const info = ref<UpdateInfo | null>(null);
  const error = ref<string | null>(null);
  const lastChecked = ref<number | null>(null);
  const prerelease = ref<boolean>(localStorage.getItem(LS_PRERELEASE) === "true");

  const downloaded = ref(0);
  const total = ref<number | null>(null);

  let autoTimer: number | null = null;

  const isBusy = computed(() => status.value === "checking" || status.value === "downloading");
  const updateAvailable = computed(() => status.value === "available");
  const progressPct = computed<number | null>(() => {
    if (total.value === null || total.value === 0) return null;
    return Math.min(100, Math.round((downloaded.value / total.value) * 100));
  });

  function setPrerelease(value: boolean) {
    prerelease.value = value;
    localStorage.setItem(LS_PRERELEASE, String(value));
  }

  /**
   * Check the current channel for an update. Pass `{ silent: true }` for
   * background checks so failures don't throw (they still populate `error`).
   */
  async function check(opts: { silent?: boolean } = {}): Promise<void> {
    if (isBusy.value) return;
    status.value = "checking";
    error.value = null;
    try {
      const result = await invokeCommand("updater_check", {
        prerelease: prerelease.value,
      });
      lastChecked.value = Date.now();
      if (result) {
        info.value = result;
        status.value = "available";
      } else {
        info.value = null;
        status.value = "up-to-date";
      }
    } catch (err) {
      error.value = String(err);
      status.value = "error";
      if (!opts.silent) throw err;
    }
  }

  /** Download + install the pending update, then the app relaunches. */
  async function install(): Promise<void> {
    if (status.value !== "available") return;
    status.value = "downloading";
    error.value = null;
    downloaded.value = 0;
    total.value = null;

    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenEvent("updater://progress", (payload) => {
        if (payload.contentLength !== null) total.value = payload.contentLength;
        downloaded.value += payload.chunkLength;
      });
      // Resolves only if the relaunch doesn't happen (e.g. install error).
      await invokeCommand("updater_install");
    } catch (err) {
      error.value = String(err);
      status.value = "error";
    } finally {
      unlisten?.();
    }
  }

  /** Run a silent check now and every 6h. Idempotent — safe to call once. */
  function startAutoCheck(): void {
    if (autoTimer !== null) return;
    void check({ silent: true });
    autoTimer = window.setInterval(() => void check({ silent: true }), RECHECK_INTERVAL_MS);
  }

  return {
    status,
    info,
    error,
    lastChecked,
    prerelease,
    downloaded,
    total,
    isBusy,
    updateAvailable,
    progressPct,
    setPrerelease,
    check,
    install,
    startAutoCheck,
  };
});
