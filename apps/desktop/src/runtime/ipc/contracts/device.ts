import type {
  ADBDevice,
  AdbPackage,
  AdbPackageDetails,
  DeviceFileContent,
  DeviceInfo,
  FileEntry,
  ReverseRule,
  WebViewSocket,
} from "@/types/adb.types";
import type {
  AndroidVirtualDevice,
  EmulatorLaunchResult,
  EmulatorStopResult,
} from "@/types/emulator.types";
import type { IpcCommand, JsonValue } from "@/runtime/ipc/contracts/common";
import type { SessionPackageScope } from "@/runtime/ipc/contracts/session";

export interface DeviceCommandMap {
  emulator_list_avds: IpcCommand<undefined, AndroidVirtualDevice[]>;
  emulator_launch_avd: IpcCommand<{ avdName: string }, EmulatorLaunchResult>;
  emulator_stop_avd: IpcCommand<{ avdName: string }, EmulatorStopResult>;
  adb_start_server: IpcCommand<undefined, string>;
  adb_list_devices: IpcCommand<undefined, ADBDevice[]>;
  adb_get_device_info: IpcCommand<{ serial: string }, DeviceInfo>;
  adb_shell_command: IpcCommand<{ serial: string; command: string }, string>;
  adb_connect_device: IpcCommand<{ host: string; port: number }, void>;
  adb_disconnect_device: IpcCommand<{ host: string; port: number }, void>;
  adb_pair_device: IpcCommand<{ host: string; port: number; code: string }, void>;
  adb_tcpip: IpcCommand<{ serial: string; port: number }, void>;
  adb_reboot: IpcCommand<{ serial: string; mode?: string }, void>;
  adb_root: IpcCommand<{ serial: string }, void>;
  adb_restart_server: IpcCommand<undefined, string>;
  adb_list_packages: IpcCommand<{ serial: string; scope?: SessionPackageScope }, AdbPackage[]>;
  adb_cancel_list_packages: IpcCommand<{ serial: string }, void>;
  adb_get_package_details: IpcCommand<{ serial: string; packageName: string }, AdbPackageDetails>;
  adb_open_package: IpcCommand<{ serial: string; packageName: string }, string>;
  adb_get_app_icon: IpcCommand<
    {
      serial: string;
      apkPath: string;
      packageName?: string;
      iconPath?: string;
    },
    string
  >;
  adb_list_webview_sockets: IpcCommand<{ serial: string }, WebViewSocket[]>;
  adb_list_debuggable_packages: IpcCommand<{ serial: string }, string[]>;
  adb_reverse: IpcCommand<{ serial: string; remotePort: number; localPort: number }, void>;
  adb_remove_reverse: IpcCommand<{ serial: string; remotePort: number }, void>;
  adb_list_reverse: IpcCommand<{ serial: string }, ReverseRule[]>;
  adb_list_dir: IpcCommand<{ serial: string; path: string }, FileEntry[]>;
  adb_pull_file: IpcCommand<{ serial: string; path: string }, string>;
  adb_read_file: IpcCommand<{ serial: string; path: string }, DeviceFileContent>;
  adb_read_file_bytes: IpcCommand<{ serial: string; path: string; maxBytes: number }, ArrayBuffer>;
  adb_open_file: IpcCommand<{ serial: string; path: string }, string>;
  adb_open_file_picker: IpcCommand<{ serial: string; path: string }, string>;
  adb_delete_file: IpcCommand<{ serial: string; path: string; isDir: boolean }, void>;
  show_in_folder: IpcCommand<{ path: string }, void>;
  save_base64_file: IpcCommand<{ path: string; data: string }, void>;
  read_local_file_base64: IpcCommand<{ path: string }, string>;
  read_local_file_bytes: IpcCommand<{ path: string }, ArrayBuffer>;
  host_file_stream_begin: IpcCommand<{ path: string }, number>;
  host_file_stream_append: IpcCommand<Uint8Array, number>;
  host_file_stream_finish: IpcCommand<{ id: number }, number>;
  host_file_stream_discard: IpcCommand<{ id: number }, void>;
  local_device_name: IpcCommand<undefined, string>;
  local_webview_open_devtools: IpcCommand<{ label: string }, void>;
  local_webview_fetch_cdp_target: IpcCommand<
    { label: string; claimedTargetIds: string[] },
    JsonValue
  >;
  local_webview_inject_scrollbar_hide: IpcCommand<{ label: string }, void>;
  local_webview_navigate: IpcCommand<{ label: string; url: string }, void>;
  local_webview_set_bounds: IpcCommand<
    { label: string; x: number; y: number; width: number; height: number },
    void
  >;
}
