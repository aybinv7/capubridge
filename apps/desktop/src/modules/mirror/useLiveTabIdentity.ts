import { watch, type Ref } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { readLocalPageIdentity } from "@/components/device-manager/readLocalPageIdentity";
import { useCDP } from "@/composables/useCDP";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";
import type { CDPTarget } from "@/types/cdp.types";

const SETTLE_MS = 400;

/**
 * Keeps the selected tab's title and icon current: read once its page stops loading and after a
 * route change inside it, so the tab reads like the page, not like the address it was opened at.
 */
export function useLiveTabIdentity(
  tab: Ref<CDPTarget | null>,
  url: Ref<string>,
  loading: Ref<boolean>,
) {
  const browser = useThisPcBrowserStore();
  const { getClient } = useCDP();

  const read = useDebounceFn(async () => {
    const current = tab.value;
    const address = url.value;
    if (!current || !address || loading.value) return;
    const client = getClient(current.id);
    if (!client) return;
    try {
      const identity = await readLocalPageIdentity(client);
      if (tab.value?.id !== current.id || url.value !== address) return;
      browser.notePage(current.id, { url: address, ...identity });
    } catch (error) {
      console.warn("Could not read the tab's title and icon", error);
    }
  }, SETTLE_MS);

  watch(
    () => [tab.value?.id ?? null, url.value, loading.value] as const,
    ([id, address, busy]) => {
      if (!id || !address) return;
      const known = browser.pages[id];
      if (known?.url !== address) {
        browser.notePage(id, {
          url: address,
          title: known?.title ?? "",
          icon: known?.icon ?? null,
        });
      }
      if (!busy) void read();
    },
    { immediate: true },
  );
}
