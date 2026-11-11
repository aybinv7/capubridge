import { computed, onMounted, reactive, ref, watch, type Ref } from "vue";
import { toast } from "@/lib/toast";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";
import type { DeviceManagerPanel } from "@/stores/ui.store";
import { useAdb } from "@/composables/useAdb";

type DeviceOverview = NonNullable<
  Awaited<ReturnType<ReturnType<typeof useAdb>["getDeviceOverview"]>>
>;

const POLL_INTERVAL_MS = 3000;
/** One toast for the ADB server's state, replaced as it changes, so a flapping server never stacks them. */
const ADB_TOAST_ID = "adb-server-status";

interface DeviceManagerOptions {
  open: Ref<boolean>;
  panel: Ref<DeviceManagerPanel | null | undefined>;
  onDeviceSelected: (serial: string) => void;
}

/**
 * Which device or panel the manager shows, the device overview cache, and the open/close
 * lifecycle. Opening shows the current device; selecting a device is always an explicit act.
 */
export function useDeviceManager(options: DeviceManagerOptions) {
  const devicesStore = useDevicesStore();
  const deviceNames = useDeviceNamesStore();
  const localWebviewStore = useLocalWebviewStore();
  const targetsStore = useTargetsStore();
  const thisPc = useThisPcBrowserStore();
  const { getDeviceOverview } = useAdb();

  const activePanel = ref<DeviceManagerPanel>("device");
  const viewedSerial = ref<string | null>(null);
  /** Moves each time the manager opens, so views can refresh what they show. */
  const openings = ref(0);
  const deviceInfo = reactive<Record<string, DeviceOverview>>({});
  const loadingInfoFor = ref<string | null>(null);
  const isRefreshingDevices = ref(false);
  const forgettingSerial = ref<string | null>(null);
  const localDeviceName = ref("This PC");

  const viewedDevice = computed(
    () => devicesStore.devices.find((device) => device.serial === viewedSerial.value) ?? null,
  );
  const viewedDeviceInfo = computed(() =>
    viewedSerial.value ? (deviceInfo[viewedSerial.value] ?? null) : null,
  );

  async function withPollingPaused<T>(task: () => Promise<T>): Promise<T> {
    const wasPolling = devicesStore.isPolling;
    if (wasPolling) devicesStore.stopPolling();
    try {
      return await task();
    } finally {
      if (wasPolling && options.open.value) devicesStore.startPolling(POLL_INTERVAL_MS);
    }
  }

  async function loadDeviceInfo(serial: string) {
    if (deviceInfo[serial] || loadingInfoFor.value === serial) return;
    loadingInfoFor.value = serial;
    try {
      const info = await getDeviceOverview(serial);
      if (info) {
        deviceInfo[serial] = info;
        const model = devicesStore.devices.find((entry) => entry.serial === serial)?.model;
        if (model) deviceNames.remember(model, info.manufacturer);
      }
    } catch (error) {
      console.warn("Failed to load device overview", serial, error);
    } finally {
      if (loadingInfoFor.value === serial) loadingInfoFor.value = null;
    }
  }

  function viewDevice(serial: string) {
    viewedSerial.value = serial;
    activePanel.value = "device";
    const device = devicesStore.devices.find((entry) => entry.serial === serial);
    if (device?.status === "online" && !device.isStale) void loadDeviceInfo(serial);
  }

  async function selectDevice(serial: string) {
    const device = devicesStore.devices.find((entry) => entry.serial === serial);
    if (!device) return;
    viewDevice(serial);
    await withPollingPaused(async () => {
      await devicesStore.selectDevice(device);
      options.onDeviceSelected(serial);
    });
  }

  function showPanel(panel: DeviceManagerPanel) {
    activePanel.value = panel;
    if (panel !== "device") viewedSerial.value = null;
  }

  async function refreshDevices() {
    if (isRefreshingDevices.value) return;
    isRefreshingDevices.value = true;
    try {
      await devicesStore.refreshDevices();
      const serial = viewedSerial.value;
      if (serial && !devicesStore.devices.some((device) => device.serial === serial)) {
        const fallback = devicesStore.selectedDevice?.serial ?? devicesStore.devices[0]?.serial;
        if (fallback) viewDevice(fallback);
        else showPanel("local");
      }
    } catch (error) {
      toast.error("Failed to refresh devices", { description: String(error) });
    } finally {
      isRefreshingDevices.value = false;
    }
  }

  async function forgetDevice(serial: string) {
    forgettingSerial.value = serial;
    try {
      await devicesStore.forgetDevice(serial);
      if (viewedSerial.value === serial) showPanel("local");
    } catch (error) {
      toast.error("Failed to forget the device", { description: String(error) });
    } finally {
      forgettingSerial.value = null;
    }
  }

  /** Opens where the work is: the page on This PC, or the device the selected target runs on. */
  function onOpen() {
    openings.value += 1;
    void localWebviewStore.hideAll();
    const target = targetsStore.selectedTarget;
    const current = devicesStore.selectedDevice;
    const targetSerial = target?.source === "adb" ? (target.deviceSerial ?? null) : null;
    if (target?.source === "local" || thisPc.active) {
      showPanel("local");
    } else if (
      targetSerial &&
      devicesStore.devices.some((device) => device.serial === targetSerial)
    ) {
      viewDevice(targetSerial);
    } else if (current) {
      viewDevice(current.serial);
    } else {
      const firstOnline = devicesStore.onlineDevices[0] ?? null;
      if (firstOnline) void selectDevice(firstOnline.serial);
      else showPanel("local");
    }
    if (options.panel.value) showPanel(options.panel.value);
    void refreshDevices();
  }

  function onClose() {
    devicesStore.stopPolling();
    localWebviewStore.requestLayoutSync();
  }

  watch(options.open, (open) => (open ? onOpen() : onClose()));

  watch(
    () => {
      const device = viewedDevice.value;
      return device && device.status === "online" && !device.isStale ? device.serial : null;
    },
    (serial) => {
      if (serial && options.open.value) void loadDeviceInfo(serial);
    },
  );

  watch(
    () => devicesStore.adbServerStatus,
    (status, previous) => {
      if (status === "starting") {
        toast.loading("Starting the ADB server…", { id: ADB_TOAST_ID, duration: Infinity });
      } else if (status === "running" && previous === "starting") {
        toast.success("ADB server ready", { id: ADB_TOAST_ID, duration: 3000 });
      } else if (status === "error" && previous !== "error") {
        toast.error("The ADB server is not answering", {
          id: ADB_TOAST_ID,
          description: "Capubridge keeps trying to start it.",
        });
      }
    },
  );

  onMounted(() => {
    void localWebviewStore
      .localDeviceName()
      .then((name) => {
        localDeviceName.value = name;
      })
      .catch((error) => console.warn("Failed to read the local device name", error));
  });

  return {
    activePanel,
    openings,
    viewedSerial,
    viewedDevice,
    viewedDeviceInfo,
    loadingInfoFor,
    isRefreshingDevices,
    forgettingSerial,
    localDeviceName,
    withPollingPaused,
    loadDeviceInfo,
    viewDevice,
    selectDevice,
    showPanel,
    refreshDevices,
    forgetDevice,
    rememberDeviceInfo: (serial: string, info: DeviceOverview) => {
      deviceInfo[serial] = info;
    },
  };
}

export type DeviceManagerState = ReturnType<typeof useDeviceManager>;
