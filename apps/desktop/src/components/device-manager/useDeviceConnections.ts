import { ref } from "vue";
import { toast } from "@/lib/toast";
import { useDevicesStore } from "@/stores/devices.store";
import { useAdb } from "@/composables/useAdb";
import { guidFromSerial } from "@/lib/wireless/nearbyPhones";
import { usePairedPhonesStore } from "@/stores/pairedPhones.store";
import type { ADBDevice } from "@/types/adb.types";
import type { DeviceManagerState } from "./useDeviceManager";

const ADB_TCP_PORT = 5555;
const TCP_RESTART_DELAY_MS = 1500;

/** Splits `host:port`; null when either half is missing or the port is not 1–65535. */
export function parseHostPort(value: string): { host: string; port: number } | null {
  const trimmed = value.trim();
  const colon = trimmed.lastIndexOf(":");
  if (colon <= 0) return null;
  const host = trimmed.slice(0, colon);
  const port = Number(trimmed.slice(colon + 1));
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

/** Wi-Fi switching, TCP connect and disconnecting, each with honest feedback. */
export function useDeviceConnections(manager: DeviceManagerState) {
  const devicesStore = useDevicesStore();
  const { getDeviceOverview, tcpip, connectDevice, disconnectSerial, wifiAddress } = useAdb();
  const pairedPhones = usePairedPhonesStore();

  const switchingToWifi = ref(false);
  const connecting = ref(false);

  async function readWifiAddress(device: ADBDevice): Promise<string | null> {
    try {
      const ip = await wifiAddress(device.serial);
      if (ip) return ip;
    } catch (error) {
      console.warn("Could not read the Wi-Fi address; falling back to the device overview", error);
    }
    const known = manager.viewedDeviceInfo.value?.ipAddresses?.[0];
    if (known) return known;
    const info = await getDeviceOverview(device.serial);
    if (!info) return null;
    manager.rememberDeviceInfo(device.serial, info);
    return info.ipAddresses?.[0] ?? null;
  }

  /**
   * Android 10 and older: restarts adbd in TCP mode on 5555 through the cable, then connects to
   * the phone's Wi-Fi address, read before the restart drops the USB link.
   */
  async function switchToWifi(device: ADBDevice): Promise<boolean> {
    if (switchingToWifi.value) return false;
    switchingToWifi.value = true;
    try {
      return await manager.withPollingPaused(async () => {
        const ip = await readWifiAddress(device);
        if (!ip) {
          toast.warning("Turn on Wi-Fi on the phone first", {
            description:
              "The phone has no Wi-Fi address, so it cannot be reached without the cable.",
          });
          return false;
        }
        await tcpip(device.serial, ADB_TCP_PORT);
        await new Promise<void>((resolve) => setTimeout(resolve, TCP_RESTART_DELAY_MS));
        await connectDevice(ip, ADB_TCP_PORT);
        await devicesStore.refreshDevices();
        toast.success("Wi-Fi debugging is on", {
          description: "The phone is connected over Wi-Fi. You can unplug the cable.",
        });
        return true;
      });
    } catch (error) {
      toast.error("Could not switch to Wi-Fi debugging", { description: String(error) });
      return false;
    } finally {
      switchingToWifi.value = false;
    }
  }

  async function disconnect(device: ADBDevice) {
    if (device.connectionType !== "usb") {
      pairedPhones.holdReconnect(guidFromSerial(device.serial) ?? device.serial);
      try {
        await disconnectSerial(device.serial);
      } catch (error) {
        console.warn("Failed to disconnect device", device.serial, error);
      }
    }
    manager.showPanel("local");
    try {
      await devicesStore.refreshDevices();
      toast.info("Device disconnected");
    } catch (error) {
      toast.error("Disconnected, but the device list did not refresh", {
        description: String(error),
      });
    }
  }

  async function connectTcp(host: string, port: number): Promise<boolean> {
    if (!host.trim()) {
      toast.error("Enter the device IP address");
      return false;
    }
    connecting.value = true;
    try {
      await connectDevice(host.trim(), port);
      toast.success("Device connected", { description: `${host.trim()}:${port}` });
      await devicesStore.refreshDevices();
      return true;
    } catch (error) {
      toast.error("Could not connect", { description: String(error) });
      return false;
    } finally {
      connecting.value = false;
    }
  }

  return { switchingToWifi, connecting, switchToWifi, disconnect, connectTcp };
}
