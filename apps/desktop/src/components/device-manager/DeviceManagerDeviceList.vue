<script setup lang="ts">
import { computed } from "vue";
import { ListButton, ListTitle, StatusDot } from "@capubridge/cladd";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { ADBDevice } from "@/types/adb.types";
import DeviceKindIcon from "./DeviceKindIcon.vue";
import DeviceListRow from "./DeviceListRow.vue";
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
</script>

<template>
  <div class="flex flex-col gap-3" role="group" aria-label="Devices">
    <p v-if="groups.length === 0" class="px-2.5 py-2 text-xs text-muted-foreground">
      No Android device is connected. Plug one in over USB, connect one over Wi-Fi, or start an
      emulator.
    </p>

    <section v-for="group in groups" :key="group.id" class="flex flex-col gap-0.5">
      <ListTitle class="px-2.5 pb-1 text-2xs font-normal normal-case text-[var(--fg-subtle)]">
        {{ group.label }}
      </ListTitle>
      <ContextMenu v-for="device in group.devices" :key="device.serial">
        <ContextMenuTrigger as-child>
          <div>
            <DeviceListRow
              :device="device"
              :viewed="props.viewedSerial === device.serial"
              :in-use="props.inUseSerial === device.serial"
              :busy="props.forgettingSerial === device.serial"
              @select="emit('selectDevice', device.serial)"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem variant="destructive" @select="emit('forgetDevice', device.serial)">
            Forget this device
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </section>

    <section class="flex flex-col gap-0.5">
      <ListTitle class="px-2.5 pb-1 text-2xs font-normal normal-case text-[var(--fg-subtle)]">
        This computer
      </ListTitle>
      <ListButton
        size="md"
        :selected="props.localViewed"
        data-roving-item
        :data-current="props.localViewed || undefined"
        class="w-full"
        content-class-name="gap-2.5 px-2.5 py-1.5"
        icon-class-name="text-muted-foreground"
        @click="emit('selectLocal')"
      >
        <template #icon>
          <DeviceKindIcon local />
        </template>
        <span class="truncate text-sm font-medium text-foreground">{{
          props.localDeviceName
        }}</span>
        <template #footer>
          <span class="flex items-center gap-1.5 text-2xs">
            <StatusDot color="green" size="xs" />
            <span class="text-muted-foreground">Local pages in a native WebView</span>
          </span>
        </template>
      </ListButton>
    </section>
  </div>
</template>
