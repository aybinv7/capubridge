export type ConsoleEntryLevel = "log" | "info" | "warn" | "error" | "debug";

export interface ConsoleArgPrimitive {
  kind: "primitive";
  text: string;
}

export interface ConsoleArgObject {
  kind: "object";
  description: string;
  subtype: string | null;
  properties: ConsoleProp[];
  overflow: boolean;
  objectId: string | null;
}

export type ConsoleArg = ConsoleArgPrimitive | ConsoleArgObject;

export interface ConsoleProp {
  name: string;
  value: ConsoleArg;
}

export interface ConsoleEntry {
  id: string;
  targetId: string;
  timestamp: number;
  timestampLabel: string;
  level: ConsoleEntryLevel;
  source: string;
  message: string;
  args: ConsoleArg[];
  parentId: string | null;
  isGroup: boolean;
  groupCollapsed: boolean;
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
