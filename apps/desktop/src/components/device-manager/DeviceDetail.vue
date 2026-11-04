<script setup lang="ts">
import { computed } from "vue";
import type { ADBDevice } from "@/types/adb.types";
import type { CDPTarget } from "@/types/cdp.types";
import type { LinkPresentation } from "@/lib/gates/link";
import DeviceDetailHeader from "./DeviceDetailHeader.vue";
import DeviceStateNotice from "./DeviceStateNotice.vue";
import TargetList from "./TargetList.vue";
import { describeDeviceState, deviceDisplayName } from "./deviceState";
import type { TargetGroup } from "./targetGroups";

const props = defineProps<{
  device: ADBDevice;
  androidVersion: string | null;
  apiLevel: number | null;
  loadingInfo: boolean;
  switchingToWifi: boolean;
  forgetting: boolean;
  refreshingDevices: boolean;
  groups: TargetGroup[];
  selectedTargetId: string | null;
  link: LinkPresentation;
  scanning: boolean;
}>();

const emit = defineEmits<{
  useWifi: [];
  disconnect: [];
  forget: [];
  rescanDevices: [];
  rescanTargets: [];
  select: [target: CDPTarget];
  inspect: [target: CDPTarget];
  detach: [target: CDPTarget];
}>();

const state = computed(() => describeDeviceState(props.device));
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <DeviceDetailHeader
      :device="props.device"
      :android-version="props.androidVersion"
      :api-level="props.apiLevel"
      :loading-info="props.loadingInfo"
      :switching-to-wifi="props.switchingToWifi"
      :forgetting="props.forgetting"
      @use-wifi="emit('useWifi')"
      @disconnect="emit('disconnect')"
      @forget="emit('forget')"
    />

    <div v-if="state.title" class="px-5">
      <DeviceStateNotice
        :state="state"
        :refreshing="props.refreshingDevices"
        @rescan="emit('rescanDevices')"
      />
    </div>

    <TargetList
      v-else
      :serial="props.device.serial"
      :device-name="deviceDisplayName(props.device)"
      :groups="props.groups"
      :selected-target-id="props.selectedTargetId"
      :link="props.link"
      :scanning="props.scanning"
      @rescan="emit('rescanTargets')"
      @select="emit('select', $event)"
      @inspect="emit('inspect', $event)"
      @detach="emit('detach', $event)"
    />
  </div>
</template>
