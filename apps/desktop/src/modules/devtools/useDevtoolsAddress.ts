import { computed, ref, watch } from "vue";
import { isNativeAppTarget } from "@/lib/app-target";
import { invokeCommand } from "@/runtime/ipc/client";
import { useDevtoolsSettingsStore } from "@/stores/devtoolsSettings.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";
import type { CDPTarget } from "@/types/cdp.types";
import { devtoolsUrlFor, phoneDevtoolsUrl } from "./inspectorUrl";

/**
 * Where the docked DevTools points for the selected page: a tab on This PC straight at its own
 * socket, a phone's WebView (over USB or Wi-Fi alike) through Capubridge's loopback proxy. Both use
 * the frontend bundled with the local pages' browser, so neither needs the network.
 */
export function useDevtoolsAddress() {
  const targets = useTargetsStore();
  const thisPc = useThisPcBrowserStore();
  const settings = useDevtoolsSettingsStore();

  const url = ref<string | null>(null);
  const error = ref<string | null>(null);
  const resolving = ref(false);
  let revision = 0;

  const subject = computed<CDPTarget | null>(() => {
    const selected = targets.selectedTarget;
    if (selected?.source === "local") return thisPc.showingNewTab ? null : thisPc.selectedTab;
    if (selected?.source === "adb" && !isNativeAppTarget(selected)) return selected;
    return null;
  });

  async function resolve() {
    const attempt = ++revision;
    error.value = null;
    const target = subject.value;
    const socket = target?.webSocketDebuggerUrl;
    const show = !settings.hideScreencast;
    if (!target || !socket) {
      url.value = null;
      return;
    }
    if (target.source === "local") {
      url.value = devtoolsUrlFor(socket, show);
      return;
    }
    resolving.value = true;
    try {
      const [proxy, port] = await Promise.all([
        invokeCommand("cdp_start_proxy", { wsUrl: socket }),
        invokeCommand("local_devtools_port"),
      ]);
      if (attempt !== revision) return;
      url.value = phoneDevtoolsUrl(port, proxy.wsUrl, show);
      if (!url.value) error.value = "The phone's DevTools address could not be built.";
    } catch (failure) {
      if (attempt !== revision) return;
      url.value = null;
      error.value = failure instanceof Error ? failure.message : String(failure);
    } finally {
      if (attempt === revision) resolving.value = false;
    }
  }

  watch(
    () =>
      [subject.value?.id, subject.value?.webSocketDebuggerUrl, settings.hideScreencast] as const,
    () => void resolve(),
    { immediate: true },
  );

  return { subject, url, error, resolving, retry: resolve };
}
