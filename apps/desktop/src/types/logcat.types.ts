export type LogcatLevel = "V" | "D" | "I" | "W" | "E" | "F";

export type LogcatStreamState = "connecting" | "live" | "reconnecting" | "stopped";

/** Device clock relative to the host: `hostMs = deviceMs - offsetMs`. */
export interface LogcatClockSample {
  offsetMs: number;
  rttMs: number;
  measuredAtMs: number;
}

/** One log entry as Rust sends it. `tsMs` is the device's epoch time. */
export interface LogcatLinePayload {
  seq: number;
  tsMs: number;
  uid: number | null;
  pid: number | null;
  tid: number | null;
  level: LogcatLevel;
  tag: string;
  message: string;
  processName: string | null;
  packageName: string | null;
}

export interface LogcatBatchPayload {
  serial: string;
  generation: number;
  lines: LogcatLinePayload[];
}

export interface LogcatStatusPayload {
  serial: string;
  generation: number;
  state: LogcatStreamState;
  attempt: number;
  message: string | null;
  retryInMs: number | null;
  clock: LogcatClockSample | null;
  clockWentBack: boolean;
}

/** A log entry as the app keeps it. `date` and `time` show the device clock in host local time. */
export interface LogcatEntry {
  id: string;
  seq: number;
  serial: string;
  tsMs: number;
  date: string;
  time: string;
  uid: number | null;
  pid: number | null;
  tid: number | null;
  level: LogcatLevel;
  tag: string;
  processName: string | null;
  packageName: string | null;
  message: string;
}
