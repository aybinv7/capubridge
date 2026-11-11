<script setup lang="ts">
import RecordSplit from "@/shared/components/layout/RecordSplit.vue";
import { useRecordPaneStore } from "@/stores/recordPane.store";

/** The record split of every Data tab, placed where the one Data-wide choice says. */
const props = withDefaults(defineProps<{ paneOpen: boolean; maximized?: boolean }>(), {
  maximized: false,
});

defineSlots<{ grid: () => unknown; pane: (props: { maximized: boolean }) => unknown }>();

const recordPane = useRecordPaneStore();
</script>

<template>
  <RecordSplit
    :pane-open="props.paneOpen"
    :maximized="props.maximized"
    :placement="recordPane.placement"
  >
    <template #grid><slot name="grid" /></template>
    <template #pane="paneProps"><slot name="pane" v-bind="paneProps" /></template>
  </RecordSplit>
</template>
