import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";

/** Reloads the selected page over CDP so its requests are captured from the start. */
export function usePageReload() {
  const targets = useTargetsStore();
  const { getClient } = useCDP();
  const reloading = ref(false);

  const canReload = computed(() => !!targets.cdpTargetId);

  async function reload() {
    const id = targets.cdpTargetId;
    const client = id ? getClient(id) : undefined;
    if (!client) {
      toast.error("Could not reload the page", {
        description: "The connection to the app's DevTools is closed.",
      });
      return;
    }
    reloading.value = true;
    try {
      await client.send("Page.reload", { ignoreCache: false });
    } catch (error) {
      toast.error("Could not reload the page", { description: String(error) });
    } finally {
      reloading.value = false;
    }
  }

  return { reloading, canReload, reload };
}
