<script setup lang="ts">
import { computed } from "vue";
import { Monitor, MonitorSmartphone, Smartphone, Wifi } from "lucide-vue-next";
import type { ADBDevice } from "@/types/adb.types";

const props = defineProps<{
  device?: Pick<ADBDevice, "deviceKind" | "connectionType"> | null;
  local?: boolean;
  size?: number;
}>();

const icon = computed(() => {
  if (props.local) return Monitor;
  if (props.device?.deviceKind === "emulator") return MonitorSmartphone;
  if (props.device?.connectionType === "wifi") return Wifi;
  return Smartphone;
});
</script>

<template>
  <component :is="icon" :size="props.size ?? 15" :stroke-width="1.7" aria-hidden="true" />
</template>
