import { invoke } from "@tauri-apps/api/core";
import type { ADBDevice, WebViewSocket } from "@/types/adb.types";

export type { WebViewSocket };

export interface DeviceOverview {
  name: string;
  manufacturer: string;
  model: string;
  apiLevel: number;
  serial: string;
  availableStorage: number;
  totalStorage: number;
  screenResolution: string;
  ipAddresses: string[];
  androidVersion: string;
}

export function useAdb() {
  async function refreshDevices(): Promise<ADBDevice[]> {
    try {
      return await invoke<ADBDevice[]>("adb_list_devices");
    } catch (err) {
      console.error("Failed to refresh devices:", err);
      return [];
    }
  }

  async function getDeviceOverview(deviceId: string): Promise<DeviceOverview | null> {
    try {
      const info = await invoke<{
        model: string;
        manufacturer: string;
        androidVersion: string;
        apiLevel: number;
        serial: string;
        screenResolution: string;
        ipAddresses: string[];
        availableStorage: number;
        totalStorage: number;
      }>("adb_get_device_info", { serial: deviceId });

      return {
        name: info.model || "",
        manufacturer: info.manufacturer || "",
        model: info.model || "",
        androidVersion: info.androidVersion || "",
        apiLevel: info.apiLevel,
        serial: info.serial,
        screenResolution: info.screenResolution || "",
        ipAddresses: info.ipAddresses ?? [],
        availableStorage: info.availableStorage,
        totalStorage: info.totalStorage,
      };
    } catch (err) {
      console.error("Failed to get device overview:", err);
      return null;
    }
  }

  async function shellCommand(serial: string, command: string): Promise<string> {
    return await invoke<string>("adb_shell_command", { serial, command });
  }

  async function connectDevice(host: string, port: number) {
    await invoke("adb_connect_device", { host, port });
  }

  async function disconnectDevice(host: string, port: number) {
    await invoke("adb_disconnect_device", { host, port });
  }

  async function pairDevice(host: string, port: number, code: string) {
    await invoke("adb_pair_device", { host, port, code });
  }

  async function tcpip(serial: string, port = 5555) {
    await invoke("adb_tcpip", { serial, port });
  }

  async function root(serial: string) {
    await invoke("adb_root", { serial });
  }

  async function reboot(serial: string, mode?: "recovery" | "bootloader") {
    await invoke("adb_reboot", { serial, mode });
  }

  async function restartServer() {
    await invoke("adb_restart_server");
  }

  async function listWebViewSockets(serial: string): Promise<WebViewSocket[]> {
    return invoke<WebViewSocket[]>("adb_list_webview_sockets", { serial });
  }

  async function forward(serial: string, local: string, _remote: string) {
    await invoke("adb_forward_cdp", { serial, localPort: parseInt(local.replace("tcp:", ""), 10) });
  }

  return {
    refreshDevices,
    getDeviceOverview,
    shellCommand,
    connectDevice,
    disconnectDevice,
    pairDevice,
    tcpip,
    root,
    reboot,
    restartServer,
    forward,
    listWebViewSockets,
  };
}
