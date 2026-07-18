import type { AdbPackage, DeviceInfo, ReverseRule, WebViewSocket } from "@/types/adb.types";
import type {
  SessionDeviceSnapshot,
  SessionLeaseState,
  SessionRegistrySnapshot,
  SessionTargetSnapshot,
} from "@/types/session.types";
import type { IpcCommand } from "@/runtime/ipc/contracts/common";

export type SessionPackageScope = "third-party" | "all";

export interface SessionCommandMap {
  session_list_devices: IpcCommand<undefined, SessionDeviceSnapshot[]>;
  session_get_registry_state: IpcCommand<undefined, SessionRegistrySnapshot>;
  session_refresh_devices: IpcCommand<undefined, SessionRegistrySnapshot>;
  session_set_active_device: IpcCommand<{ serial: string | null }, SessionRegistrySnapshot>;
  session_get_device_info: IpcCommand<{ serial: string }, DeviceInfo>;
  session_shell_command: IpcCommand<{ serial: string; command: string }, string>;
  session_tcpip: IpcCommand<{ serial: string; port: number }, void>;
  session_reboot: IpcCommand<{ serial: string; mode?: "recovery" | "bootloader" }, void>;
  session_root: IpcCommand<{ serial: string }, void>;
  session_list_packages: IpcCommand<{ serial: string; scope?: SessionPackageScope }, AdbPackage[]>;
  session_refresh_packages: IpcCommand<
    { serial: string; scope?: SessionPackageScope },
    AdbPackage[]
  >;
  session_cancel_list_packages: IpcCommand<{ serial: string }, void>;
  session_open_package: IpcCommand<{ serial: string; packageName: string }, string>;
  session_reverse: IpcCommand<{ serial: string; remotePort: number; localPort: number }, void>;
  session_remove_reverse: IpcCommand<{ serial: string; remotePort: number }, void>;
  session_list_reverse: IpcCommand<{ serial: string }, ReverseRule[]>;
  session_list_webview_sockets: IpcCommand<{ serial: string }, WebViewSocket[]>;
  session_list_targets: IpcCommand<{ serial: string }, SessionTargetSnapshot[]>;
  session_refresh_targets: IpcCommand<{ serial: string }, SessionTargetSnapshot[]>;
  session_start_logcat_lease: IpcCommand<{ serial: string }, SessionLeaseState>;
  session_stop_logcat_lease: IpcCommand<{ serial: string }, SessionLeaseState>;
  session_start_perf_lease: IpcCommand<{ serial: string }, SessionLeaseState>;
  session_stop_perf_lease: IpcCommand<{ serial: string }, SessionLeaseState>;
  session_start_mirror_lease: IpcCommand<{ serial: string }, SessionLeaseState>;
  session_stop_mirror_lease: IpcCommand<{ serial: string }, SessionLeaseState>;
  session_attach_console_target: IpcCommand<
    { serial: string; targetId: string },
    SessionLeaseState
  >;
  session_detach_console_target: IpcCommand<{ serial: string }, SessionLeaseState>;
}
