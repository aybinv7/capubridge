import { ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useInspectStore } from "@/stores/inspect.store";
import { useCDP } from "@/composables/useCDP";
import { CSSDomain, DOMDomain } from "utils";
import type { MatchedStyles, ComputedStyle, BoxModel } from "@/types/inspect.types";

export function useElementStyles() {
  const store = useInspectStore();
  const { selectedNodeId } = storeToRefs(store);
  const { activeClient } = useCDP();

  const matchedStyles = ref<MatchedStyles | null>(null);
  const computedStyles = ref<ComputedStyle[]>([]);
  const boxModel = ref<BoxModel | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  let cssDomain: CSSDomain | null = null;
  let domDomain: DOMDomain | null = null;

  watch(
    activeClient,
    (client) => {
      if (client) {
        cssDomain = new CSSDomain(client);
        domDomain = new DOMDomain(client);
        cssDomain.enable().catch(() => {});
      }
    },
    { immediate: true },
  );

  watch(selectedNodeId, async (nodeId) => {
    if (!nodeId || !cssDomain || !domDomain) {
      matchedStyles.value = null;
      computedStyles.value = [];
      boxModel.value = null;
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const [matched, computed, box] = await Promise.all([
        cssDomain.getMatchedStylesForNode(nodeId),
        cssDomain.getComputedStyleForNode(nodeId),
        domDomain.getBoxModel(nodeId).catch(() => null),
      ]);

      matchedStyles.value = matched;
      computedStyles.value = computed;
      boxModel.value = box;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading.value = false;
    }
  });

  return {
    matchedStyles,
    computedStyles,
    boxModel,
    isLoading,
    error,
  };
}
