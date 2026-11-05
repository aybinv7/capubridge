import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  IpcArgsCommand,
  IpcCommandArgs,
  IpcCommandName,
  IpcCommandResult,
  IpcNoArgsCommand,
} from "@/runtime/ipc/contract";
import type { IpcEventName, IpcEventPayload } from "@/runtime/ipc/events";
import { normalizeIpcError } from "@/runtime/ipc/error";

export async function invokeCommandRaw(command: IpcCommandName, args?: object): Promise<unknown> {
  try {
    return await invoke<unknown>(command, args ? { ...args } : undefined);
  } catch (cause) {
    throw normalizeIpcError(cause, { operation: "invoke", name: command });
  }
}

export function invokeCommand<Name extends IpcNoArgsCommand>(
  command: Name,
): Promise<IpcCommandResult<Name>>;
export function invokeCommand<Name extends IpcArgsCommand>(
  command: Name,
  args: IpcCommandArgs<Name>,
): Promise<IpcCommandResult<Name>>;
export function invokeCommand(command: IpcCommandName, args?: object): Promise<unknown> {
  return invokeCommandRaw(command, args);
}

type IpcBytesCommand = {
  [Name in IpcCommandName]: IpcCommandArgs<Name> extends Uint8Array ? Name : never;
}[IpcCommandName];

/** Sends raw bytes as the request body (no JSON, no base64), with string headers beside them. */
export async function invokeCommandBytes<Name extends IpcBytesCommand>(
  command: Name,
  bytes: Uint8Array,
  headers: Record<string, string>,
): Promise<IpcCommandResult<Name>> {
  try {
    return await invoke<IpcCommandResult<Name>>(command, bytes, { headers });
  } catch (cause) {
    throw normalizeIpcError(cause, { operation: "invoke", name: command });
  }
}

export async function listenEvent<Name extends IpcEventName>(
  eventName: Name,
  onMessage: (payload: IpcEventPayload<Name>) => void,
): Promise<() => void> {
  try {
    return await listen<IpcEventPayload<Name>>(eventName, (event) => onMessage(event.payload));
  } catch (cause) {
    throw normalizeIpcError(cause, { operation: "listen", name: eventName });
  }
}
