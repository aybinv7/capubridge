<script setup lang="ts">
import { ref } from "vue";
import { toast } from "vue-sonner";
import { ArrowUpRight } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { useAdb } from "@/composables/useAdb";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";

const props = defineProps<{ serial: string; packageName: string; appName: string }>();

const { openPackage } = useAdb();
const presenceStore = useTargetPresenceStore();
const busy = ref(false);

async function bringToFront() {
  if (busy.value) return;
  busy.value = true;
  try {
    await openPackage(props.serial, props.packageName);
    presenceStore.probeNow();
  } catch (error) {
    toast.error(`Could not bring ${props.appName} to the front`, { description: String(error) });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Button
    variant="solid"
    surface-level="+2"
    size="sm"
    class="pointer-events-auto shadow-float"
    content-class-name="gap-1.5 pl-2.5 pr-3 [&>svg]:size-3.5"
    :loading="busy"
    :title="`${props.appName} is in the background; the screen shows whatever is in front`"
    @click="bringToFront"
  >
    <ArrowUpRight :stroke-width="1.8" />
    <span class="max-w-48 truncate">Bring {{ props.appName }} to front</span>
  </Button>
</template>
