import type { IpcCommand } from "@/runtime/ipc/contracts/common";
import type { QrPairingStart, WirelessDiscovery } from "@/types/wireless.types";

export interface WirelessCommandMap {
  adb_wifi_address: IpcCommand<{ serial: string }, string | null>;
  wireless_discover: IpcCommand<undefined, WirelessDiscovery>;
  wireless_discover_stop: IpcCommand<undefined, void>;
  wireless_pairing_start: IpcCommand<undefined, QrPairingStart>;
  wireless_pairing_with_code: IpcCommand<{ host: string; port: number; code: string }, number>;
  wireless_pairing_cancel: IpcCommand<{ sessionId: number }, void>;
}
