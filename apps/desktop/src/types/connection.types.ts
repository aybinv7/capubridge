export type ConnectionSourceType = "adb" | "chrome";

export interface ADBSource {
  type: "adb";
  serial: string;
}

export interface ChromeSource {
  type: "chrome";
  port: number;
  mode: "auto" | "manual";
  pid?: number;
}

export type ConnectionSource = ADBSource | ChromeSource;

export interface ChromeLaunchResult {
  pid: number;
  port: number;
}

export interface ChromeFindResult {
  found: boolean;
  path: string | null;
  alreadyRunning: boolean;
}
