import { computed, onMounted, reactive, ref, watch, type Ref } from "vue";
import { toast } from "vue-sonner";
import { useDevicesStore } from "@/stores/devices.store";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import type { DeviceManagerPanel } from "@/stores/ui.store";
import { useAdb } from "@/composables/useAdb";

type DeviceOverview = NonNullable<
  Awaited<ReturnType<ReturnType<typeof useAdb>["getDeviceOverview"]>>
>;

const POLL_INTERVAL_MS = 3000;

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
  const localWebviewStore = useLocalWebviewStore();
  const { getDeviceOverview } = useAdb();

  const activePanel = ref<DeviceManagerPanel>("device");
  const viewedSerial = ref<string | null>(null);
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
      if (info) deviceInfo[serial] = info;
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

  function onOpen() {
    void localWebviewStore.hideAll();
    const current = devicesStore.selectedDevice;
    if (current) {
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

  let adbToastId: string | number | undefined;
  watch(
    () => devicesStore.adbServerStatus,
    (status, previous) => {
      if (status === "starting") {
        adbToastId = toast.loading("Starting the ADB server…", { duration: Infinity });
      } else if (status === "running" && previous === "starting") {
        if (adbToastId !== undefined) toast.dismiss(adbToastId);
        toast.success("ADB server ready");
        adbToastId = undefined;
      } else if (status === "error") {
        if (adbToastId !== undefined) toast.dismiss(adbToastId);
        toast.error("Could not start the ADB server", {
          description: "Make sure adb is installed and on your PATH.",
        });
        adbToastId = undefined;
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
