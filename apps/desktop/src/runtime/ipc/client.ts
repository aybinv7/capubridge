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
