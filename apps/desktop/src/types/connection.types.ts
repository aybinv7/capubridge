export type ConnectionSourceType = "adb" | "chrome" | "local";

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

export interface LocalSource {
  type: "local";
}

export type ConnectionSource = ADBSource | ChromeSource | LocalSource;

export interface ChromeLaunchResult {
  pid: number;
  port: number;
}

export interface ChromeFindResult {
  found: boolean;
  path: string | null;
  alreadyRunning: boolean;
}
