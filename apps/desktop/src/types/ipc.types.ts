// Mirrors Tauri command signatures — keep in sync with src-tauri/src/commands/
// Usage: invoke<ReturnType>('command_name', params)

import type { ADBDevice, ADBPackage, AdbPackageDetails, DeviceInfo, FileEntry } from "./adb.types";
import type { ChromeLaunchResult, ChromeFindResult } from "./connection.types";

export type {
  ADBDevice,
  ADBPackage,
  AdbPackageDetails,
  DeviceInfo,
  FileEntry,
  ChromeLaunchResult,
  ChromeFindResult,
};

// ADB commands
// invoke('adb_list_devices'): Promise<ADBDevice[]>
// invoke('adb_get_device_info', { serial: string }): Promise<DeviceInfo>
// invoke('adb_list_packages', { serial: string }): Promise<ADBPackage[]>
// invoke('adb_cancel_list_packages', { serial: string }): Promise<void>
// invoke('adb_get_package_details', { serial: string, packageName: string }): Promise<AdbPackageDetails>
// invoke('adb_open_package', { serial: string, packageName: string }): Promise<string>
// invoke('adb_force_stop', { serial: string, packageName: string }): Promise<void>
// invoke('adb_clear_data', { serial: string, packageName: string }): Promise<void>
// invoke('adb_uninstall', { serial: string, packageName: string }): Promise<void>
// invoke('adb_list_files', { serial: string, path: string }): Promise<FileEntry[]>
// invoke('adb_pull_file', { serial: string, devicePath: string, hostPath: string }): Promise<void>
// invoke('adb_push_file', { serial: string, hostPath: string, devicePath: string }): Promise<void>
// invoke('adb_forward_cdp', { serial: string, localPort: number }): Promise<void>
// invoke('adb_remove_forward', { serial: string, localPort: number }): Promise<void>
// invoke('start_logcat', { serial: string }): Promise<void>
// invoke('stop_logcat', { serial: string }): Promise<void>

// Chrome commands
// invoke('chrome_find'): Promise<ChromeFindResult>
// invoke('chrome_launch', { port: number }): Promise<ChromeLaunchResult>
// invoke('chrome_verify_port', { port: number }): Promise<boolean>

// File I/O
// invoke('save_export', { path: string, content: string }): Promise<void>
// invoke('read_import', { path: string }): Promise<string>
