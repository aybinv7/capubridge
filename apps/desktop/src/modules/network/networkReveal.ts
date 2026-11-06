import type { Router } from "vue-router";
import { registerReveal } from "@/shared/timeline/revealRegistry";
import { NETWORK_MAX_ENTRIES } from "./networkRetention";
import { useNetworkStore } from "./stores/useNetworkStore";

const count = new Intl.NumberFormat();

/**
 * Lets the timeline open a request: Network → Requests, the request selected (its details
 * open) and scrolled into view. Filters that hide it are cleared. Returns the unregister.
 */
export function registerNetworkReveal(router: Router): () => void {
  const store = useNetworkStore();
  return registerReveal("network", {
    keeps: `Network keeps the last ${count.format(NETWORK_MAX_ENTRIES)} requests, and can start over when the page navigates`,
    isKept: (ref) => store.getEntry(ref.id) !== undefined,
    async reveal(ref) {
      if (store.getEntry(ref.id) === undefined) return false;
      await router.push({ name: "network-requests" });
      if (!store.filteredEntries.some((entry) => entry.requestId === ref.id)) store.clearFilters();
      store.select(ref.id);
      store.requestReveal();
      return true;
    },
  });
}
