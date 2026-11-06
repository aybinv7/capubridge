import { ref } from "vue";
import { toast } from "@/lib/toast";
import { useDevicesStore } from "@/stores/devices.store";
import { useAdb } from "@/composables/useAdb";
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

/** Wi-Fi switching, TCP connect, pairing and disconnecting, each with honest feedback. */
export function useDeviceConnections(manager: DeviceManagerState) {
  const devicesStore = useDevicesStore();
  const { getDeviceOverview, tcpip, connectDevice, disconnectDevice, pairDevice } = useAdb();

  const switchingToWifi = ref(false);
  const connecting = ref(false);
  const pairing = ref(false);

  async function switchToWifi(device: ADBDevice) {
    if (switchingToWifi.value) return;
    switchingToWifi.value = true;
    try {
      await manager.withPollingPaused(async () => {
        let ip = manager.viewedDeviceInfo.value?.ipAddresses?.[0];
        if (!ip) {
          const info = await getDeviceOverview(device.serial);
          if (info) {
            manager.rememberDeviceInfo(device.serial, info);
            ip = info.ipAddresses?.[0];
          }
        }
        await tcpip(device.serial, ADB_TCP_PORT);
        if (!ip) {
          toast.warning("Wi-Fi debugging is on; connect it by address", {
            description: `The device IP could not be read. Use Connect a device with <ip>:${ADB_TCP_PORT}.`,
          });
          return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, TCP_RESTART_DELAY_MS));
        await connectDevice(ip, ADB_TCP_PORT);
        await devicesStore.refreshDevices();
        toast.success("Wi-Fi debugging is on", {
          description: `Connected through ${ip}:${ADB_TCP_PORT}. You can unplug the cable.`,
        });
      });
    } catch (error) {
      toast.error("Could not switch to Wi-Fi debugging", { description: String(error) });
    } finally {
      switchingToWifi.value = false;
    }
  }

  async function disconnect(device: ADBDevice) {
    if (device.connectionType !== "usb") {
      const address = parseHostPort(device.serial);
      if (address) {
        try {
          await disconnectDevice(address.host, address.port);
        } catch (error) {
          console.warn("Failed to disconnect device", device.serial, error);
        }
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

  async function pair(address: string, code: string): Promise<boolean> {
    const target = parseHostPort(address);
    if (!target) {
      toast.error("Enter the pairing address as ip:port", {
        description:
          "It is shown under “Pair device with pairing code”, for example 192.168.1.20:37261.",
      });
      return false;
    }
    if (!code.trim()) {
      toast.error("Enter the six-digit pairing code");
      return false;
    }
    pairing.value = true;
    try {
      await pairDevice(target.host, target.port, code.trim());
      toast.success("Paired", {
        description: "Now connect it with the address shown under Wireless debugging.",
      });
      return true;
    } catch (error) {
      toast.error("Pairing failed", { description: String(error) });
      return false;
    } finally {
      pairing.value = false;
    }
  }

  return { switchingToWifi, connecting, pairing, switchToWifi, disconnect, connectTcp, pair };
}
