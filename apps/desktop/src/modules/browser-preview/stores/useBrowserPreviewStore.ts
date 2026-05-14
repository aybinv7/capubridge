import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { BrowserPreviewPortPreset } from "@/modules/browser-preview/browserPreview.constants";
import { normalizePreviewUrl, probePreviewUrl } from "@/modules/browser-preview/browserPreviewUrl";

const URL_KEY = "capubridge:browser-preview:url";
const RECENT_KEY = "capubridge:browser-preview:recent";
const MAX_RECENT = 8;

function readRecentUrls(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export const useBrowserPreviewStore = defineStore("browser-preview", () => {
  const url = ref(localStorage.getItem(URL_KEY) ?? "");
  const loadVersion = ref(0);
  const notice = ref<string | null>(null);
  const checkingPort = ref<number | null>(null);
  const recentUrls = ref<string[]>(readRecentUrls());

  const hasUrl = computed(() => url.value.length > 0);

  function persistUrl(nextUrl: string) {
    if (nextUrl) {
      localStorage.setItem(URL_KEY, nextUrl);
      return;
    }

    localStorage.removeItem(URL_KEY);
  }

  function persistRecent() {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentUrls.value));
  }

  function pushRecent(nextUrl: string) {
    recentUrls.value = [nextUrl, ...recentUrls.value.filter((item) => item !== nextUrl)].slice(
      0,
      MAX_RECENT,
    );
    persistRecent();
  }

  function navigate(raw: string): boolean {
    const normalized = normalizePreviewUrl(raw);
    if (!normalized) {
      notice.value = "Enter a valid http or https URL.";
      return false;
    }

    url.value = normalized;
    loadVersion.value += 1;
    notice.value = null;
    persistUrl(normalized);
    pushRecent(normalized);
    return true;
  }

  function reload() {
    if (!url.value) return;
    loadVersion.value += 1;
  }

  function clear() {
    url.value = "";
    loadVersion.value += 1;
    notice.value = null;
    persistUrl("");
  }

  async function openPortPreset(preset: BrowserPreviewPortPreset) {
    const nextUrl = `http://localhost:${preset.port}`;
    checkingPort.value = preset.port;
    notice.value = null;

    const isReachable = await probePreviewUrl(nextUrl);
    checkingPort.value = null;

    if (!isReachable) {
      notice.value = `No server answered on :${preset.port}.`;
      return false;
    }

    return navigate(nextUrl);
  }

  return {
    url,
    loadVersion,
    notice,
    checkingPort,
    recentUrls,
    hasUrl,
    navigate,
    reload,
    clear,
    openPortPreset,
  };
});
