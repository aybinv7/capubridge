import type { CDPClient } from "./client.js";

/** A script evaluated on the device threw, or rejected, instead of returning a value. */
export class DeviceEvaluationError extends Error {
  override name = "DeviceEvaluationError";
}

interface ExceptionDetails {
  text?: string;
  exception?: { description?: string; value?: unknown };
}

interface RawEvaluateResponse {
  result?: Record<string, unknown>;
  exceptionDetails?: ExceptionDetails;
}

export interface EvaluateParams extends Record<string, unknown> {
  expression: string;
  awaitPromise?: boolean;
  returnByValue?: boolean;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value) ?? "undefined";
}

function describeException(details: ExceptionDetails): string {
  const description = details.exception?.description;
  if (description) return description.split("\n")[0] ?? description;
  if (details.exception?.value !== undefined) return textOf(details.exception.value);
  return details.text ?? "Script failed on the device";
}

/**
 * `Runtime.evaluate` that turns a device-side exception or rejected promise into a
 * `DeviceEvaluationError`. CDP reports those in `exceptionDetails` with a normal
 * response, so an unchecked call silently reads `undefined`.
 */
export async function evaluateChecked(
  client: CDPClient,
  params: EvaluateParams,
): Promise<{ result: Record<string, unknown> }> {
  const response = await client.send<RawEvaluateResponse>("Runtime.evaluate", params);
  if (response.exceptionDetails) {
    throw new DeviceEvaluationError(describeException(response.exceptionDetails));
  }
  return { result: response.result ?? {} };
}

/**
 * A JavaScript literal for interpolating host data into a device script. Never build
 * device scripts by quoting strings by hand: keys and values are user data.
 */
export function jsLiteral(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}

/**
 * Text safe inside a single-quoted JavaScript string. Prefer `jsLiteral`; this
 * exists for templates that already wrap a value in single quotes.
 */
export function singleQuotedContent(value: string): string {
  return JSON.stringify(value).slice(1, -1).replace(/'/g, "\\'");
}

/**
 * Throws when a device script reported `{ error }` instead of a result. Device
 * scripts in this package catch and serialise their own failures this way.
 */
export function assertNoDeviceError(payload: unknown): void {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error: unknown }).error;
    throw new DeviceEvaluationError(message == null ? "Device script failed" : textOf(message));
  }
}
