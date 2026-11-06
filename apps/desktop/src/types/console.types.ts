export type ConsoleEntryLevel = "log" | "info" | "warn" | "error" | "debug";

/** The JavaScript type of a primitive value, when the protocol said it. */
export type ConsolePrimitiveType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "undefined"
  | "null"
  | "symbol"
  | "function";

export interface ConsoleArgPrimitive {
  kind: "primitive";
  text: string;
  valueType?: ConsolePrimitiveType;
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

/** One call frame of a console or exception stack, 1-based like the source label. */
export interface StackFrame {
  functionName: string;
  url: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  /** `file.js:12:4`, or "runtime" when the frame has no URL. */
  source: string;
}

export interface ConsoleEntry {
  seq: number;
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
  /** The request a network-sourced `Log.entryAdded` message is about. */
  networkRequestId?: string | null;
  /** Call frames for errors, warnings, traces and asserts; other calls keep none. */
  frames?: StackFrame[] | null;
}

export interface ConsoleExceptionEntry {
  seq: number;
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
  frames?: StackFrame[];
}

export interface ReplHistoryEntry {
  /**
   * Places of the input and its result in the console's sequence, so messages the expression
   * logged sit between them.
   */
  seq: number;
  resultSeq: number;
  id: string;
  targetId: string;
  timestamp: number;
  timestampLabel: string;
  expression: string;
  result: string;
  status: "ok" | "error";
}
