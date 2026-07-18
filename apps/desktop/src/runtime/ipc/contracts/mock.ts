import type { IpcCommand } from "@/runtime/ipc/contracts/common";

export interface MockServerRule {
  id: string;
  method: string;
  url_pattern: string;
  url_match_type: string;
  status_code: number;
  response_headers: [string, string][];
  response_body: string;
  delay_ms: number;
}

export interface MockServerStatus {
  running: boolean;
  port: number;
}

export interface MockCommandMap {
  mock_server_start: IpcCommand<{ port: number }, void>;
  mock_server_stop: IpcCommand<undefined, void>;
  mock_server_sync_rules: IpcCommand<{ rules: MockServerRule[] }, void>;
  mock_server_status: IpcCommand<undefined, MockServerStatus>;
}
