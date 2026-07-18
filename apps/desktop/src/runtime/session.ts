import { Effect, Layer } from "effect";
import { invokeCommandEffect, listenEventEffect } from "@/runtime/ipc/effect";
import { normalizeSessionError, type SessionRequestOptions } from "@/runtime/effect/cancellation";
import {
  SessionBridge,
  type SessionBridgeService,
  type SessionPackageScope,
} from "@/runtime/effect/tags";
import type { SessionEvent } from "@/types/session.types";

export const SESSION_EVENT_NAME = "capubridge:session-event" as const;

export function getRegistryStateEffect() {
  return invokeCommandEffect("session_get_registry_state");
}

export function listDevicesEffect() {
  return invokeCommandEffect("session_list_devices");
}

export function refreshDevicesEffect() {
  return invokeCommandEffect("session_refresh_devices");
}

export function setActiveDeviceEffect(serial: string | null) {
  return invokeCommandEffect("session_set_active_device", { serial });
}

export function getDeviceInfoEffect(serial: string) {
  return invokeCommandEffect("session_get_device_info", { serial });
}

export function shellCommandEffect(serial: string, command: string) {
  return invokeCommandEffect("session_shell_command", { serial, command });
}

export function tcpipEffect(serial: string, port: number) {
  return invokeCommandEffect("session_tcpip", { serial, port });
}

export function rootEffect(serial: string) {
  return invokeCommandEffect("session_root", { serial });
}

export function rebootEffect(serial: string, mode?: "recovery" | "bootloader") {
  return invokeCommandEffect("session_reboot", { serial, mode });
}

export function listPackagesEffect(serial: string, scope: SessionPackageScope = "all") {
  return invokeCommandEffect("session_list_packages", { serial, scope });
}

export function refreshPackagesEffect(serial: string, scope: SessionPackageScope = "all") {
  return invokeCommandEffect("session_refresh_packages", { serial, scope });
}

export function cancelListPackagesEffect(serial: string) {
  return invokeCommandEffect("session_cancel_list_packages", { serial });
}

export function openPackageEffect(serial: string, packageName: string) {
  return invokeCommandEffect("session_open_package", { serial, packageName });
}

export function reverseEffect(serial: string, remotePort: number, localPort: number) {
  return invokeCommandEffect("session_reverse", { serial, remotePort, localPort });
}

export function removeReverseEffect(serial: string, remotePort: number) {
  return invokeCommandEffect("session_remove_reverse", { serial, remotePort });
}

export function listReverseEffect(serial: string) {
  return invokeCommandEffect("session_list_reverse", { serial });
}

export function listWebViewSocketsEffect(serial: string) {
  return invokeCommandEffect("session_list_webview_sockets", { serial });
}

export function listTargetsEffect(serial: string) {
  return invokeCommandEffect("session_list_targets", { serial });
}

export function refreshTargetsEffect(serial: string) {
  return invokeCommandEffect("session_refresh_targets", { serial });
}

export function startLogcatLeaseEffect(serial: string) {
  return invokeCommandEffect("session_start_logcat_lease", { serial });
}

export function stopLogcatLeaseEffect(serial: string) {
  return invokeCommandEffect("session_stop_logcat_lease", { serial });
}

export function startPerfLeaseEffect(serial: string) {
  return invokeCommandEffect("session_start_perf_lease", { serial });
}

export function stopPerfLeaseEffect(serial: string) {
  return invokeCommandEffect("session_stop_perf_lease", { serial });
}

export function startMirrorLeaseEffect(serial: string) {
  return invokeCommandEffect("session_start_mirror_lease", { serial });
}

export function stopMirrorLeaseEffect(serial: string) {
  return invokeCommandEffect("session_stop_mirror_lease", { serial });
}

export function attachConsoleTargetEffect(serial: string, targetId: string) {
  return invokeCommandEffect("session_attach_console_target", { serial, targetId });
}

export function detachConsoleTargetEffect(serial: string) {
  return invokeCommandEffect("session_detach_console_target", { serial });
}

export function subscribeSessionEventsEffect(onEvent: (event: SessionEvent) => void) {
  return listenEventEffect(SESSION_EVENT_NAME, onEvent);
}

export const sessionBridgeService: SessionBridgeService = {
  getRegistryState: getRegistryStateEffect,
  listDevices: listDevicesEffect,
  refreshDevices: refreshDevicesEffect,
  setActiveDevice: setActiveDeviceEffect,
  getDeviceInfo: getDeviceInfoEffect,
  shellCommand: shellCommandEffect,
  tcpip: tcpipEffect,
  root: rootEffect,
  reboot: rebootEffect,
  listPackages: listPackagesEffect,
  refreshPackages: refreshPackagesEffect,
  cancelPackages: cancelListPackagesEffect,
  openPackage: openPackageEffect,
  reverse: reverseEffect,
  removeReverse: removeReverseEffect,
  listReverse: listReverseEffect,
  listWebViewSockets: listWebViewSocketsEffect,
  listTargets: listTargetsEffect,
  refreshTargets: refreshTargetsEffect,
  startLogcatLease: startLogcatLeaseEffect,
  stopLogcatLease: stopLogcatLeaseEffect,
  startPerfLease: startPerfLeaseEffect,
  stopPerfLease: stopPerfLeaseEffect,
  startMirrorLease: startMirrorLeaseEffect,
  stopMirrorLease: stopMirrorLeaseEffect,
  attachConsoleTarget: attachConsoleTargetEffect,
  detachConsoleTarget: detachConsoleTargetEffect,
  subscribe: subscribeSessionEventsEffect,
};

export const SessionBridgeLive = Layer.succeed(SessionBridge, sessionBridgeService);

export function runSessionEffect<Success, Error>(
  effect: Effect.Effect<Success, Error>,
  options: SessionRequestOptions,
): Promise<Success> {
  return Effect.runPromise(effect, { signal: options.signal }).catch((cause) =>
    normalizeSessionError(cause, options),
  );
}
