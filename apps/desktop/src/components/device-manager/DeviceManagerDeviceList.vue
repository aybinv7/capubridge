<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight } from "lucide-vue-next";
import type { ADBDevice } from "@/types/adb.types";
import { useDeviceHardwareStore } from "@/stores/deviceHardware.store";
import DeviceEntryRow from "./DeviceEntryRow.vue";
import LocalDeviceRow from "./LocalDeviceRow.vue";
import { arrangeDeviceList, mergeDeviceConnections, type DeviceEntry } from "./deviceEntries";

const props = defineProps<{
  devices: ADBDevice[];
  localDeviceName: string;
  localViewed: boolean;
  viewedSerial: string | null;
  forgettingSerial?: string | null;
}>();

const emit = defineEmits<{
  selectLocal: [];
  selectDevice: [serial: string];
  forgetDevice: [serial: string];
}>();

const hardware = useDeviceHardwareStore();
const list = computed(() =>
  arrangeDeviceList(mergeDeviceConnections(props.devices, hardware.hardwareOf)),
);
const earlierOpen = ref(false);

function holds(entry: DeviceEntry, serial: string | null | undefined) {
  return serial != null && entry.connections.some((device) => device.serial === serial);
}

const showEarlier = computed(
  () => earlierOpen.value || list.value.earlier.some((entry) => holds(entry, props.viewedSerial)),
);

function forget(entry: DeviceEntry) {
  for (const connection of entry.connections) emit("forgetDevice", connection.serial);
}
</script>

<template>
  <div class="flex flex-col gap-0.5" role="group" aria-label="Devices">
    <p v-if="list.live.length === 0" class="px-2.5 pt-1 pb-2 text-xs text-muted-foreground">
      No Android device is connected. Plug one in over USB, connect over Wi-Fi, or start an
      emulator.
    </p>

    <DeviceEntryRow
      v-for="entry in list.live"
      :key="entry.device.serial"
      :entry="entry"
      :viewed="holds(entry, props.viewedSerial)"
      :busy="holds(entry, props.forgettingSerial)"
      @select="emit('selectDevice', entry.device.serial)"
      @forget="forget(entry)"
    />

    <LocalDeviceRow
      :name="props.localDeviceName"
      :viewed="props.localViewed"
      @select="emit('selectLocal')"
    />

    <DeviceEntryRow
      v-for="entry in list.recent"
      :key="entry.device.serial"
      :entry="entry"
      :viewed="holds(entry, props.viewedSerial)"
      :busy="holds(entry, props.forgettingSerial)"
      @select="emit('selectDevice', entry.device.serial)"
      @forget="forget(entry)"
    />

    <template v-if="list.earlier.length">
      <button
        type="button"
        data-roving-item
        class="mt-1.5 flex items-center gap-1.5 rounded-control px-2.5 py-1 text-left text-2xs text-[var(--fg-subtle)] outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        :aria-expanded="showEarlier"
        @click="earlierOpen = !earlierOpen"
      >
        <ChevronRight
          :size="12"
          class="shrink-0 transition-transform duration-120"
          :class="showEarlier && 'rotate-90'"
          aria-hidden="true"
        />
        <span class="flex-1">Earlier connections</span>
        <span class="font-mono tabular-nums">{{ list.earlier.length }}</span>
      </button>
      <template v-if="showEarlier">
        <DeviceEntryRow
          v-for="entry in list.earlier"
          :key="entry.device.serial"
          :entry="entry"
          :viewed="holds(entry, props.viewedSerial)"
          :busy="holds(entry, props.forgettingSerial)"
          @select="emit('selectDevice', entry.device.serial)"
          @forget="forget(entry)"
        />
      </template>
    </template>
  </div>
</template>
