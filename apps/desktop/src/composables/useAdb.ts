import { invokeCommand } from "@/runtime/ipc/client";
import {
  cancelListPackagesEffect,
  getDeviceInfoEffect,
  listPackagesEffect,
  listReverseEffect,
  listWebViewSocketsEffect,
  openPackageEffect,
  rebootEffect,
  removeReverseEffect,
  reverseEffect,
  rootEffect,
  runSessionEffect,
  shellCommandEffect,
  tcpipEffect,
} from "@/runtime/session";
import type { SessionRequestOptions } from "@/runtime/effect/cancellation";
import { isSessionInterruptedError } from "@/runtime/effect/tags";
import type {
  ADBDevice,
  AdbPackage,
  AdbPackageDetails,
  ReverseRule,
  WebViewSocket,
} from "@/types/adb.types";

export type { WebViewSocket };
export type PackageListScope = "third-party" | "all";

export interface DeviceOverview {
  name: string;
  manufacturer: string;
  model: string;
  apiLevel: number;
  serial: string;
  availableStorage: number;
  totalStorage: number;
  totalRam: number;
  screenResolution: string;
  ipAddresses: string[];
  androidVersion: string;
}

export function useAdb() {
  async function refreshDevices(): Promise<ADBDevice[]> {
    return await invokeCommand("adb_list_devices");
  }

  async function getDeviceOverview(
    deviceId: string,
    options?: Omit<SessionRequestOptions, "operation">,
  ): Promise<DeviceOverview | null> {
    try {
      const info = await runSessionEffect(getDeviceInfoEffect(deviceId), {
        operation: "session.getDeviceInfo",
        signal: options?.signal,
      });

      return {
        name: info.model || "",
        manufacturer: info.manufacturer || "",
        model: info.cpuArch ? `${info.model} · ${info.cpuArch}` : info.model || "",
        androidVersion: info.androidVersion || "",
        apiLevel: info.apiLevel,
        serial: info.serial,
        screenResolution: info.screenResolution || "",
        ipAddresses: info.ipAddresses ?? [],
        availableStorage: info.availableStorage,
        totalStorage: info.totalStorage,
        totalRam: info.totalRam ?? 0,
      };
    } catch (err) {
      if (isSessionInterruptedError(err)) {
        throw err;
      }
      console.error("Failed to get device overview:", err);
      return null;
    }
  }

  async function shellCommand(
    serial: string,
    command: string,
    options?: Omit<SessionRequestOptions, "operation">,
  ): Promise<string> {
    return runSessionEffect(shellCommandEffect(serial, command), {
      operation: "session.shellCommand",
      signal: options?.signal,
    });
  }

  async function connectDevice(host: string, port: number) {
    await invokeCommand("adb_connect_device", { host, port });
  }

  async function disconnectDevice(host: string, port: number) {
    await invokeCommand("adb_disconnect_device", { host, port });
  }

  async function pairDevice(host: string, port: number, code: string) {
    await invokeCommand("adb_pair_device", { host, port, code });
  }

  async function tcpip(serial: string, port = 5555) {
    await runSessionEffect(tcpipEffect(serial, port), {
      operation: "session.tcpip",
    });
  }

  async function root(serial: string) {
    await runSessionEffect(rootEffect(serial), {
      operation: "session.root",
    });
  }

  async function reboot(serial: string, mode?: "recovery" | "bootloader") {
    await runSessionEffect(rebootEffect(serial, mode), {
      operation: "session.reboot",
    });
  }

  async function restartServer() {
    await invokeCommand("adb_restart_server");
  }

  async function listPackages(
    serial: string,
    scope: PackageListScope = "all",
    options?: Omit<SessionRequestOptions, "operation">,
  ): Promise<AdbPackage[]> {
    return runSessionEffect(listPackagesEffect(serial, scope), {
      operation: "session.listPackages",
      signal: options?.signal,
    });
  }

  async function cancelListPackages(
    serial: string,
    options?: Omit<SessionRequestOptions, "operation">,
  ): Promise<void> {
    await runSessionEffect(cancelListPackagesEffect(serial), {
      operation: "session.cancelListPackages",
      signal: options?.signal,
    });
  }

  async function getPackageDetails(
    serial: string,
    packageName: string,
  ): Promise<AdbPackageDetails> {
    return invokeCommand("adb_get_package_details", { serial, packageName });
  }

  async function openPackage(serial: string, packageName: string): Promise<string> {
    return runSessionEffect(openPackageEffect(serial, packageName), {
      operation: "session.openPackage",
    });
  }

  async function listWebViewSockets(
    serial: string,
    options?: Omit<SessionRequestOptions, "operation">,
  ): Promise<WebViewSocket[]> {
    return runSessionEffect(listWebViewSocketsEffect(serial), {
      operation: "session.listWebViewSockets",
      signal: options?.signal,
    });
  }

  async function forward(serial: string, _local: string, remote: string) {
    const socketName = remote.replace(/^localabstract:/, "") || undefined;
    await invokeCommand("adb_forward_cdp", { serial, socketName });
  }

  async function reverse(serial: string, remotePort: number, localPort: number): Promise<void> {
    await runSessionEffect(reverseEffect(serial, remotePort, localPort), {
      operation: "session.reverse",
    });
  }

  async function removeReverse(serial: string, remotePort: number): Promise<void> {
    await runSessionEffect(removeReverseEffect(serial, remotePort), {
      operation: "session.removeReverse",
    });
  }

  async function listReverse(serial: string): Promise<ReverseRule[]> {
    return runSessionEffect(listReverseEffect(serial), {
      operation: "session.listReverse",
    });
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
    listPackages,
    cancelListPackages,
    getPackageDetails,
    openPackage,
    reverse,
    removeReverse,
    listReverse,
  };
}
