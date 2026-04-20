<script setup lang="ts">
import { ExternalLink } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { dockTabMeta } from "./dock-meta";
import type { DockTab } from "@/types/dock.types";

const props = defineProps<{
  tab: DockTab;
}>();

const emit = defineEmits<{
  popout: [tab: DockTab];
}>();
</script>

<template>
  <Button
    variant="ghost"
    size="icon-sm"
    class="size-8 rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
    :title="`Pop out ${dockTabMeta[props.tab].label}`"
    @click="emit('popout', props.tab)"
  >
    <ExternalLink class="size-3.5" />
  </Button>
</template>
