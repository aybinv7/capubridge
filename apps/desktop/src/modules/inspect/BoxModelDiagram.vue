<script setup lang="ts">
import { ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { OverlayDomain } from "@capubridge/cdp-protocol";
import SharedBoxModelDiagram from "@/shared/components/presentation/BoxModelDiagram.vue";
import type { BoxModelRegion } from "@/shared/components/presentation/box-model.types";
import { useCDP } from "@/composables/useCDP";
import { useInspectStore } from "@/stores/inspect.store";
import type { BoxModel, ComputedStyle } from "@/types/inspect.types";

defineProps<{
  boxModel: BoxModel | null;
  computedStyles: ComputedStyle[];
}>();

const store = useInspectStore();
const { selectedNodeId } = storeToRefs(store);
const { activeClient } = useCDP();
const overlay = ref<OverlayDomain | null>(null);

watch(
  activeClient,
  (client) => {
    overlay.value = client ? new OverlayDomain(client) : null;
  },
  { immediate: true },
);

async function highlight(region: BoxModelRegion) {
  const nodeId = selectedNodeId.value;
  if (!overlay.value || !nodeId) return;
  if (region === null) {
    await overlay.value.hideHighlight();
    return;
  }
  await overlay.value.highlightNode(nodeId);
}
</script>

<template>
  <SharedBoxModelDiagram
    :box-model="boxModel"
    :computed-styles="computedStyles"
    @region-hover="highlight"
  />
</template>
