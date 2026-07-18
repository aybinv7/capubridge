import { Effect } from "effect";
import { invokeCommandRaw, listenEvent } from "@/runtime/ipc/client";
import type {
  IpcArgsCommand,
  IpcCommandArgs,
  IpcCommandName,
  IpcCommandResult,
  IpcNoArgsCommand,
} from "@/runtime/ipc/contract";
import type { IpcEventName, IpcEventPayload } from "@/runtime/ipc/events";
import { IpcError, normalizeIpcError } from "@/runtime/ipc/error";

export function invokeCommandEffect<Name extends IpcNoArgsCommand>(
  command: Name,
): Effect.Effect<IpcCommandResult<Name>, IpcError>;
export function invokeCommandEffect<Name extends IpcArgsCommand>(
  command: Name,
  args: IpcCommandArgs<Name>,
): Effect.Effect<IpcCommandResult<Name>, IpcError>;
export function invokeCommandEffect(
  command: IpcCommandName,
  args?: object,
): Effect.Effect<unknown, IpcError> {
  return Effect.tryPromise({
    try: () => invokeCommandRaw(command, args),
    catch: (cause) => normalizeIpcError(cause, { operation: "invoke", name: command }),
  });
}

export function listenEventEffect<Name extends IpcEventName>(
  eventName: Name,
  onMessage: (payload: IpcEventPayload<Name>) => void,
): Effect.Effect<() => void, IpcError> {
  return Effect.tryPromise({
    try: () => listenEvent(eventName, onMessage),
    catch: (cause) => normalizeIpcError(cause, { operation: "listen", name: eventName }),
  });
}
