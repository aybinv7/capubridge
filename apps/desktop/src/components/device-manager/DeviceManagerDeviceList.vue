<script setup lang="ts">
import { computed } from "vue";
import { Monitor, Plus, Usb, Wifi } from "lucide-vue-next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { groupDevices, type DeviceGroupId } from "./deviceGroups";
import type { ADBDevice } from "@/types/adb.types";

const props = defineProps<{
  devices: ADBDevice[];
  localDeviceName: string;
  localActive: boolean;
  selectedSerial: string | null;
  deviceActive: boolean;
  forgettingSerial?: string | null;
}>();

const emit = defineEmits<{
  selectLocal: [];
  selectDevice: [serial: string];
  forgetDevice: [serial: string];
  launchEmulator: [];
  connectRemote: [];
}>();

const groups = computed(() => groupDevices(props.devices));

function isSelected(serial: string): boolean {
  return props.deviceActive && props.selectedSerial === serial;
}

// Only a group whose members show up on their own — a real USB handset, This
// PC itself — has no "+"; nothing here would ever add one for the user.
const ADD_ACTION: Partial<Record<DeviceGroupId, { title: string; onClick: () => void }>> = {
  emulator: { title: "Launch emulator", onClick: () => emit("launchEmulator") },
  remote: { title: "Connect remote device", onClick: () => emit("connectRemote") },
};

const EMPTY_HINT: Partial<Record<DeviceGroupId, string>> = {
  emulator: "No emulators running",
  remote: "No remote devices connected",
};

const sectionClass =
  "flex items-center justify-between gap-2 mt-1.5 mb-1 px-2.5 py-1 rounded-md bg-surface-2/60 border border-border/15";
const sectionLabelClass =
  "text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50";
const rowClass = "w-full text-left px-2.5 py-2 rounded-lg transition-colors";

function rowStateClass(active: boolean): string {
  return active
    ? "bg-surface-2 border border-border/30"
    : "hover:bg-surface-2/50 border border-transparent";
}
</script>

<template>
  <div class="flex-1 overflow-y-auto px-2 pb-2">
    <div :class="sectionClass">
      <span :class="sectionLabelClass">This PC</span>
    </div>
    <button :class="[rowClass, rowStateClass(localActive)]" @click="emit('selectLocal')">
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full shrink-0 bg-success" />
        <Monitor :size="11" class="text-muted-foreground/40 shrink-0" />
        <span class="text-[12px] font-medium text-foreground truncate">
          {{ localDeviceName }}
        </span>
      </div>
      <div class="flex items-center gap-1 mt-0.5 pl-3">
        <span class="font-mono text-[9px] text-muted-foreground/35 truncate">local-host</span>
        <span class="text-muted-foreground/20 text-[9px]">·</span>
        <span class="text-[9px] text-muted-foreground/35">Native WebView</span>
      </div>
    </button>

    <template v-for="group in groups" :key="group.id">
      <div :class="sectionClass">
        <span :class="sectionLabelClass">{{ group.label }}</span>
        <button
          v-if="ADD_ACTION[group.id]"
          class="flex h-4.5 w-4.5 items-center justify-center rounded text-muted-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground"
          :title="ADD_ACTION[group.id]?.title"
          @click="ADD_ACTION[group.id]?.onClick()"
        >
          <Plus :size="11" />
        </button>
      </div>

      <div
        v-if="group.devices.length === 0"
        class="px-2.5 py-2 text-[10px] text-muted-foreground/30 italic"
      >
        {{ EMPTY_HINT[group.id] }}
      </div>

      <ContextMenu v-for="d in group.devices" :key="d.serial">
        <ContextMenuTrigger as-child>
          <button
            :class="[rowClass, rowStateClass(isSelected(d.serial))]"
            :disabled="forgettingSerial === d.serial"
            @click="emit('selectDevice', d.serial)"
          >
            <div class="flex items-center gap-1.5">
              <span
                class="w-1.5 h-1.5 rounded-full shrink-0"
                :class="d.status === 'online' ? 'bg-success' : 'bg-muted-foreground/25'"
              />
              <span class="text-[12px] font-medium text-foreground truncate">
                {{ d.model || d.serial }}
              </span>
              <span
                v-if="d.isStale"
                class="ml-auto text-[9px] px-1.5 py-0.5 rounded-full border border-border/20 bg-surface-2 text-muted-foreground/45"
              >
                stale
              </span>
            </div>
            <div class="flex items-center gap-1 mt-0.5 pl-3">
              <span class="font-mono text-[9px] text-muted-foreground/35 truncate">
                {{ d.serial.slice(0, 16) }}
              </span>
              <span class="text-muted-foreground/20 text-[9px]">·</span>
              <component
                :is="d.connectionType === 'usb' ? Usb : Wifi"
                :size="9"
                class="text-muted-foreground/30 shrink-0"
              />
              <span class="text-[9px] text-muted-foreground/35">
                {{ d.connectionType === "usb" ? "USB" : "WiFi" }}
              </span>
            </div>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem variant="destructive" @select="emit('forgetDevice', d.serial)">
            Forget device
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </template>
  </div>
</template>
