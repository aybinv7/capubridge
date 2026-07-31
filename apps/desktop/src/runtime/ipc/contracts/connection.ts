import type { ChromeFindResult, ChromeLaunchResult } from "@/types/connection.types";
import type { CdpJsonTarget, IpcCommand } from "@/runtime/ipc/contracts/common";

export interface CdpProxyResult {
  localPort: number;
  wsUrl: string;
}

export interface ConnectionCommandMap {
  adb_forward_cdp: IpcCommand<{ serial: string; socketName?: string }, number>;
  adb_remove_forward: IpcCommand<{ serial: string }, void>;
  adb_fetch_json_targets: IpcCommand<{ port: number }, CdpJsonTarget[]>;
  cdp_start_proxy: IpcCommand<{ wsUrl: string }, CdpProxyResult>;
  cdp_stop_proxy: IpcCommand<{ wsUrl: string }, void>;
  chrome_find: IpcCommand<undefined, ChromeFindResult>;
  chrome_is_running: IpcCommand<undefined, boolean>;
  chrome_kill_all: IpcCommand<undefined, void>;
  chrome_launch: IpcCommand<{ port: number }, ChromeLaunchResult>;
  chrome_verify_port: IpcCommand<{ port: number }, boolean>;
  chrome_fetch_targets: IpcCommand<{ port: number }, CdpJsonTarget[]>;
  chrome_open_devtools_url: IpcCommand<{ url: string }, void>;
  chrome_open_target: IpcCommand<{ port: number; url: string }, CdpJsonTarget>;
  chrome_activate_target: IpcCommand<{ port: number; targetId: string }, void>;
}
