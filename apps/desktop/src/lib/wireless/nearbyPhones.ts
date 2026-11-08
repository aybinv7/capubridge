import type { ADBDevice } from "@/types/adb.types";
import type { MdnsService } from "@/types/wireless.types";

const CONNECT_SERIAL_SUFFIX = "._adb-tls-connect._tcp";

/** A phone advertising its wireless debugging connect service, as the panel lists it. */
export interface NearbyPhone {
  /** The mDNS instance name, stable per phone: what Capubridge remembers it by. */
  guid: string;
  host: string;
  port: number;
  /** The serial adb lists it under when it is already connected. */
  connectedSerial: string | null;
}

/** The guid inside an mDNS serial (`<guid>._adb-tls-connect._tcp`), or null for `ip:port`. */
export function guidFromSerial(serial: string): string | null {
  return serial.endsWith(CONNECT_SERIAL_SUFFIX)
    ? serial.slice(0, -CONNECT_SERIAL_SUFFIX.length)
    : null;
}

function serialsFor(service: MdnsService): string[] {
  return [`${service.name}${CONNECT_SERIAL_SUFFIX}`, `${service.host}:${service.port}`];
}

/**
 * Connect services merged with the device list: one row per phone, marked connected when adb
 * already lists it online under its mDNS serial or its address.
 */
export function nearbyPhones(services: MdnsService[], devices: ADBDevice[]): NearbyPhone[] {
  const online = new Set(
    devices
      .filter((device) => device.status === "online" && !device.isStale)
      .map((device) => device.serial),
  );
  const phones = new Map<string, NearbyPhone>();
  for (const service of services) {
    if (service.kind !== "connect") continue;
    const connectedSerial = serialsFor(service).find((serial) => online.has(serial)) ?? null;
    phones.set(service.name, {
      guid: service.name,
      host: service.host,
      port: service.port,
      connectedSerial,
    });
  }
  return [...phones.values()];
}

/** Phones showing "Pair device with pairing code": pairing services that are not a QR session. */
export function codePairingServices(services: MdnsService[]): MdnsService[] {
  return services.filter(
    (service) => service.kind === "pairing" && !service.name.startsWith("studio-"),
  );
}
