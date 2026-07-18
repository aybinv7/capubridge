export type IpcErrorCategory =
  | "cancelled"
  | "validation"
  | "not-found"
  | "permission"
  | "conflict"
  | "timeout"
  | "unavailable"
  | "transport"
  | "command-failed"
  | "internal"
  | "unknown";

export interface IpcErrorContext {
  operation: "invoke" | "listen";
  name: string;
  signal?: AbortSignal;
}

interface IpcErrorDetails {
  operation: "invoke" | "listen";
  name: string;
  category: IpcErrorCategory;
  code: string;
  message: string;
  retryable: boolean;
  cause: unknown;
}

export class IpcError extends Error {
  readonly _tag = "IpcError";
  readonly operation: "invoke" | "listen";
  readonly command?: string;
  readonly eventName?: string;
  readonly category: IpcErrorCategory;
  readonly code: string;
  readonly retryable: boolean;
  override readonly cause: unknown;

  constructor(details: IpcErrorDetails) {
    super(details.message);
    this.name = "IpcError";
    this.operation = details.operation;
    this.command = details.operation === "invoke" ? details.name : undefined;
    this.eventName = details.operation === "listen" ? details.name : undefined;
    this.category = details.category;
    this.code = details.code;
    this.retryable = details.retryable;
    this.cause = details.cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

function readBoolean(value: unknown, key: string): boolean | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = value[key];
  return typeof candidate === "boolean" ? candidate : undefined;
}

function readCategory(value: unknown): IpcErrorCategory | undefined {
  const category = readString(value, "category");
  if (!category) return undefined;
  const categories: IpcErrorCategory[] = [
    "cancelled",
    "validation",
    "not-found",
    "permission",
    "conflict",
    "timeout",
    "unavailable",
    "transport",
    "command-failed",
    "internal",
    "unknown",
  ];
  return categories.find((candidate) => candidate === category);
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim()) return cause.message;
  const structured = readString(cause, "message") ?? readString(cause, "error");
  if (structured) return structured;
  if (typeof cause === "string" && cause.trim()) return cause;
  return "Unknown IPC failure";
}

function classify(message: string): IpcErrorCategory {
  const normalized = message.toLowerCase();
  if (/abort|cancel|interrupt/.test(normalized)) return "cancelled";
  if (/invalid|validation|must be|required/.test(normalized)) return "validation";
  if (/not found|no such|missing/.test(normalized)) return "not-found";
  if (/permission|denied|forbidden|unauthorized/.test(normalized)) return "permission";
  if (/already|conflict|in use/.test(normalized)) return "conflict";
  if (/timeout|timed out/.test(normalized)) return "timeout";
  if (/unavailable|offline|disconnected|not connected|not running/.test(normalized)) {
    return "unavailable";
  }
  if (/network|socket|websocket|transport|connection/.test(normalized)) return "transport";
  return "command-failed";
}

function defaultCode(category: IpcErrorCategory): string {
  return `IPC_${category.replace("-", "_").toUpperCase()}`;
}

export function normalizeIpcError(cause: unknown, context: IpcErrorContext): IpcError {
  if (cause instanceof IpcError) return cause;

  const message = context.signal?.aborted ? "IPC operation cancelled" : errorMessage(cause);
  const category = context.signal?.aborted
    ? "cancelled"
    : (readCategory(cause) ?? classify(message));
  const code = readString(cause, "code") ?? defaultCode(category);
  const retryable = context.signal?.aborted
    ? false
    : (readBoolean(cause, "retryable") ??
      ["timeout", "transport", "unavailable"].includes(category));

  return new IpcError({
    operation: context.operation,
    name: context.name,
    category,
    code,
    message,
    retryable,
    cause,
  });
}
