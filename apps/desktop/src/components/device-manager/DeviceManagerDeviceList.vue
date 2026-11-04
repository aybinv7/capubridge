<script setup lang="ts">
import { computed, ref } from "vue";
import { ListTitle } from "@capubridge/cladd";
import type { ADBDevice } from "@/types/adb.types";
import DeviceGroupSection from "./DeviceGroupSection.vue";
import LocalDeviceRow from "./LocalDeviceRow.vue";
import { groupDevices } from "./deviceGroups";

const props = defineProps<{
  devices: ADBDevice[];
  localDeviceName: string;
  localViewed: boolean;
  viewedSerial: string | null;
  inUseSerial: string | null;
  forgettingSerial?: string | null;
}>();

const emit = defineEmits<{
  selectLocal: [];
  selectDevice: [serial: string];
  forgetDevice: [serial: string];
}>();

const groups = computed(() => groupDevices(props.devices));
const liveGroups = computed(() => groups.value.filter((group) => !group.history));
const historyGroups = computed(() => groups.value.filter((group) => group.history));
const expanded = ref(new Set<string>());

function isExpanded(groupId: string, holdsViewed: boolean) {
  return holdsViewed || expanded.value.has(groupId);
}

function toggle(groupId: string) {
  const next = new Set(expanded.value);
  if (next.has(groupId)) next.delete(groupId);
  else next.add(groupId);
  expanded.value = next;
}

function holdsViewed(devices: ADBDevice[]) {
  return devices.some((device) => device.serial === props.viewedSerial);
}
</script>

<template>
  <div class="flex flex-col gap-3" role="group" aria-label="Devices">
    <p v-if="liveGroups.length === 0" class="px-2.5 py-2 text-xs text-muted-foreground">
      No Android device is connected. Plug one in over USB, connect one over Wi-Fi, or start an
      emulator.
    </p>

    <DeviceGroupSection
      v-for="group in liveGroups"
      :key="group.id"
      :group="group"
      :expanded="true"
      :viewed-serial="props.viewedSerial"
      :in-use-serial="props.inUseSerial"
      :forgetting-serial="props.forgettingSerial"
      @select-device="emit('selectDevice', $event)"
      @forget-device="emit('forgetDevice', $event)"
    />

    <section class="flex flex-col gap-0.5">
      <ListTitle class="px-2.5 pb-1 text-2xs font-normal normal-case text-[var(--fg-subtle)]">
        This computer
      </ListTitle>
      <LocalDeviceRow
        :name="props.localDeviceName"
        :viewed="props.localViewed"
        @select="emit('selectLocal')"
      />
    </section>

    <DeviceGroupSection
      v-for="group in historyGroups"
      :key="group.id"
      :group="group"
      :expanded="!group.collapsible || isExpanded(group.id, holdsViewed(group.devices))"
      :viewed-serial="props.viewedSerial"
      :in-use-serial="props.inUseSerial"
      :forgetting-serial="props.forgettingSerial"
      @toggle="toggle(group.id)"
      @select-device="emit('selectDevice', $event)"
      @forget-device="emit('forgetDevice', $event)"
    />
  </div>
</template>
