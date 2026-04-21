export type ConsoleEntryLevel = "log" | "info" | "warn" | "error" | "debug";

export interface ConsoleEntry {
  id: string;
  targetId: string;
  timestamp: number;
  timestampLabel: string;
  level: ConsoleEntryLevel;
  source: string;
  message: string;
  origin: "runtime" | "log";
  type: string;
  url: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

export interface ConsoleExceptionEntry {
  id: string;
  targetId: string;
  timestamp: number;
  timestampLabel: string;
  message: string;
  source: string;
  url: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  stack: string[];
}

export interface ReplHistoryEntry {
  id: string;
  targetId: string;
  timestamp: number;
  timestampLabel: string;
  expression: string;
  result: string;
  status: "ok" | "error";
}

export interface LogcatEntry {
  id: string;
  serial: string;
  date: string;
  time: string;
  pid: number | null;
  tid: number | null;
  level: "V" | "D" | "I" | "W" | "E" | "F";
  tag: string;
  processName: string | null;
  packageName: string | null;
  message: string;
  raw: string;
}

export interface LogcatErrorPayload {
  serial: string;
  message: string;
}
