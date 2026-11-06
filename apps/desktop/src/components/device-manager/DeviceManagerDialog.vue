<script setup lang="ts">
import { computed, nextTick, ref, toRef } from "vue";
import { MonitorSmartphone, RefreshCw, Wifi } from "lucide-vue-next";
import { Dialog, ListButton } from "@capubridge/cladd";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useDevicesStore } from "@/stores/devices.store";
import type { DeviceManagerPanel } from "@/stores/ui.store";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import ConnectDevicePanel from "./ConnectDevicePanel.vue";
import DeviceDetail from "./DeviceDetail.vue";
import DeviceManagerDeviceList from "./DeviceManagerDeviceList.vue";
import EmulatorPanel from "./EmulatorPanel.vue";
import LocalTargetsPanel from "./LocalTargetsPanel.vue";
import { moveRovingFocus } from "./rovingFocus";
import { useDeviceConnections } from "./useDeviceConnections";
import { useDeviceManager } from "./useDeviceManager";
import { useDeviceTargets } from "./useDeviceTargets";

const props = defineProps<{ open: boolean; panel?: DeviceManagerPanel | null }>();
const emit = defineEmits<{ close: []; selectDevice: [serial: string] }>();

const devicesStore = useDevicesStore();
const context = useActiveContextStore();

const manager = useDeviceManager({
  open: toRef(props, "open"),
  panel: toRef(props, "panel"),
  onDeviceSelected: (serial) => emit("selectDevice", serial),
});
const connections = useDeviceConnections(manager);
const targets = useDeviceTargets(manager, () => emit("close"));

const { activePanel, viewedSerial, viewedDevice, viewedDeviceInfo } = manager;

const model = computed({
  get: () => props.open,
  set: (value: boolean) => {
    if (!value) emit("close");
  },
});

const onlineCount = computed(
  () =>
    devicesStore.devices.filter((device) => device.status === "online" && !device.isStale).length,
);

const root = ref<HTMLElement | null>(null);

function focusIn(selector: string) {
  const element =
    root.value?.querySelector<HTMLElement>(`${selector} [data-roving-item][data-current]`) ??
    root.value?.querySelector<HTMLElement>(`${selector} [data-roving-item]`);
  element?.focus();
  return Boolean(element);
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.matches("[data-roving-region]")) {
    if (
      ENTRY_KEYS.has(event.key) &&
      focusIn(`[data-roving-region='${target.dataset.rovingRegion}']`)
    )
      event.preventDefault();
    return;
  }
  if (!target.matches("[data-roving-item]")) return;
  const region = target.closest<HTMLElement>("[data-roving-region]");
  if (!region) return;
  if (event.key === "ArrowRight" && region.dataset.rovingRegion === "devices") {
    if (focusIn("[data-roving-region='detail']")) event.preventDefault();
    return;
  }
  if (event.key === "ArrowLeft" && region.dataset.rovingRegion === "detail") {
    if (focusIn("[data-roving-region='devices']")) event.preventDefault();
    return;
  }
  if (moveRovingFocus(region, event.key)) event.preventDefault();
}

const ENTRY_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

/**
 * Opening focuses the device column itself, not a row: a programmatic focus on the viewed row
 * would draw the keyboard ring around it before the user pressed a key. The first arrow moves into
 * the rows, starting from the viewed one.
 */
async function onOpened() {
  await nextTick();
  root.value?.querySelector<HTMLElement>("[data-roving-region='devices']")?.focus();
}

function showConnect() {
  manager.showPanel("connect");
}

function showEmulators() {
  manager.showPanel("emulators");
}
</script>

<template>
  <Dialog
    v-model:open="model"
    aria-label="Devices and targets"
    data-overlay
    class="h-[600px] max-h-[calc(100vh-96px)] w-[900px] max-w-[calc(100vw-48px)]"
    content-class-name="flex h-full flex-row gap-0 overflow-hidden p-0"
    @opened="onOpened"
  >
    <div ref="root" class="flex h-full min-h-0 w-full" @keydown="onKeydown">
      <aside
        class="flex min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-border-subtle outline-none"
        data-roving-region="devices"
        tabindex="-1"
        aria-label="Devices"
      >
        <div class="flex h-13 shrink-0 items-center gap-2 pr-2 pl-4">
          <span class="text-sm font-medium text-foreground">Devices</span>
          <span class="font-mono text-2xs text-[var(--fg-subtle)]">{{ onlineCount }} online</span>
          <span class="flex-1" />
          <IconAction
            label="Look for devices again"
            size="sm"
            :loading="manager.isRefreshingDevices.value"
            @click="manager.refreshDevices()"
          >
            <RefreshCw :stroke-width="1.8" />
          </IconAction>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
          <DeviceManagerDeviceList
            :devices="devicesStore.devices"
            :local-device-name="manager.localDeviceName.value"
            :local-viewed="activePanel === 'local'"
            :viewed-serial="activePanel === 'device' ? viewedSerial : null"
            :forgetting-serial="manager.forgettingSerial.value"
            @select-local="manager.showPanel('local')"
            @select-device="manager.selectDevice($event)"
            @forget-device="manager.forgetDevice($event)"
          />
        </div>

        <div class="flex shrink-0 flex-col gap-0.5 border-t border-border p-2">
          <ListButton
            size="sm"
            :selected="activePanel === 'connect'"
            data-roving-item
            tight-focus-ring
            class="w-full"
            content-class-name="gap-2.5 px-2.5"
            icon-class-name="text-muted-foreground"
            @click="showConnect"
          >
            <template #icon><Wifi :stroke-width="1.7" /></template>
            <span class="text-xs font-normal">Connect over Wi-Fi</span>
          </ListButton>
          <ListButton
            size="sm"
            :selected="activePanel === 'emulators'"
            data-roving-item
            tight-focus-ring
            class="w-full"
            content-class-name="gap-2.5 px-2.5"
            icon-class-name="text-muted-foreground"
            @click="showEmulators"
          >
            <template #icon><MonitorSmartphone :stroke-width="1.7" /></template>
            <span class="text-xs font-normal">Emulators</span>
          </ListButton>
        </div>
      </aside>

      <section class="flex min-w-0 flex-1 flex-col" data-roving-region="detail">
        <DeviceDetail
          v-if="activePanel === 'device' && viewedDevice"
          :device="viewedDevice"
          :android-version="viewedDeviceInfo?.androidVersion ?? null"
          :api-level="viewedDeviceInfo?.apiLevel ?? null"
          :loading-info="manager.loadingInfoFor.value === viewedDevice.serial"
          :switching-to-wifi="connections.switchingToWifi.value"
          :forgetting="manager.forgettingSerial.value === viewedDevice.serial"
          :refreshing-devices="manager.isRefreshingDevices.value"
          :groups="targets.groups.value"
          :app-targets="targets.appTargets.value"
          :selected-target-id="targets.selectedTargetId.value"
          :link="context.link"
          :scanning="targets.isScanning.value"
          :scanning-apps="targets.isScanningApps.value"
          @use-wifi="connections.switchToWifi(viewedDevice)"
          @disconnect="connections.disconnect(viewedDevice)"
          @forget="manager.forgetDevice(viewedDevice.serial)"
          @rescan-devices="manager.refreshDevices()"
          @rescan-targets="targets.refreshTargets()"
          @select="targets.selectTarget($event)"
          @inspect="targets.inspectTarget($event)"
          @detach="targets.detachTarget($event)"
        />

        <LocalTargetsPanel
          v-else-if="activePanel === 'local'"
          :device-name="manager.localDeviceName.value"
          :targets="targets.localTargets.value"
          :selected-target-id="targets.selectedTargetId.value"
          :link="context.link"
          :creating="targets.creatingLocal.value"
          @create="targets.createLocalTarget($event)"
          @select="targets.selectTarget($event)"
          @inspect="targets.inspectTarget($event)"
          @remove="targets.removeLocalTarget($event)"
        />

        <ConnectDevicePanel
          v-else-if="activePanel === 'connect'"
          :pairing="connections.pairing.value"
          :connecting="connections.connecting.value"
          :pair="connections.pair"
          :connect="connections.connectTcp"
        />

        <EmulatorPanel
          v-else-if="activePanel === 'emulators'"
          @launched="manager.refreshDevices()"
        />

        <div
          v-else
          class="flex flex-1 flex-col items-center justify-center gap-1.5 px-10 text-center"
        >
          <p class="text-sm text-foreground">Choose a device</p>
          <p class="text-xs text-muted-foreground">
            Pick one on the left to see its WebViews, or open a page on this computer.
          </p>
        </div>
      </section>
    </div>
  </Dialog>
</template>
