import { shallowRef } from "vue";
import { toast } from "@/lib/toast";
import { guidFromSerial, type NearbyPhone } from "@/lib/wireless/nearbyPhones";
import { useAdb } from "@/composables/useAdb";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import { useDevicesStore } from "@/stores/devices.store";
import { usePairedPhonesStore } from "@/stores/pairedPhones.store";
import type { ADBDevice } from "@/types/adb.types";
import type { DeviceManagerState } from "../useDeviceManager";

const DEVICE_WAIT_ATTEMPTS = 4;
const DEVICE_WAIT_GAP_MS = 600;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Plain words for an adb connect failure; the raw reply stays in the description. */
export function connectFailureTitle(error: unknown): string {
  return /authenticate/i.test(String(error))
    ? "This phone is not paired with this computer"
    : "Could not connect over Wi-Fi";
}

/**
 * What happens once a phone is reachable over Wi-Fi: wait for adb to list it, remember it for
 * automatic reconnection, select it, and say so with a way to opt out of reconnecting.
 */
export function useWirelessConnect(manager: DeviceManagerState) {
  const devicesStore = useDevicesStore();
  const deviceNames = useDeviceNamesStore();
  const pairedPhones = usePairedPhonesStore();
  const { connectDevice } = useAdb();
  const connectingGuid = shallowRef<string | null>(null);

  async function waitForDevice(serial: string): Promise<ADBDevice | null> {
    for (let attempt = 0; attempt < DEVICE_WAIT_ATTEMPTS; attempt += 1) {
      try {
        await devicesStore.refreshDevices();
      } catch (error) {
        console.warn("Device list did not refresh after a Wi-Fi connection", error);
      }
      const device = devicesStore.devices.find(
        (entry) => entry.serial === serial && entry.status === "online",
      );
      if (device) return device;
      await delay(DEVICE_WAIT_GAP_MS);
    }
    return null;
  }

  async function adopt(serial: string, guid: string | null) {
    const device = await waitForDevice(serial);
    const label = device ? deviceNames.nameOf(device) : null;
    const phoneGuid = guid ?? guidFromSerial(serial);
    if (phoneGuid) pairedPhones.remember(phoneGuid, label);
    if (device) await manager.selectDevice(device.serial);
    const reconnects = phoneGuid ? (pairedPhones.find(phoneGuid)?.autoReconnect ?? false) : false;
    toast.success(label ? `${label} is connected over Wi-Fi` : "Connected over Wi-Fi", {
      description: reconnects
        ? "Capubridge reconnects it whenever it is nearby."
        : "It stays connected while Wireless debugging is on.",
      action:
        reconnects && phoneGuid
          ? {
              label: "Don't reconnect",
              onClick: () => pairedPhones.setAutoReconnect(phoneGuid, false),
            }
          : undefined,
    });
  }

  async function connectNearby(phone: NearbyPhone) {
    if (connectingGuid.value) return;
    connectingGuid.value = phone.guid;
    try {
      await connectDevice(phone.host, phone.port);
      await adopt(`${phone.host}:${phone.port}`, phone.guid);
    } catch (error) {
      toast.error(connectFailureTitle(error), {
        description: /authenticate/i.test(String(error))
          ? "Pair it once with the QR code; after that it connects in one click."
          : String(error),
      });
    } finally {
      connectingGuid.value = null;
    }
  }

  return { connectingGuid, adopt, connectNearby };
}
