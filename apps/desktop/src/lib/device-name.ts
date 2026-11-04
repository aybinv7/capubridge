import type { ADBDevice } from "@/types/adb.types";

export type NamedDevice = Pick<ADBDevice, "model" | "serial"> &
  Partial<Pick<ADBDevice, "deviceKind">>;

function brand(manufacturer: string): string {
  if (manufacturer !== manufacturer.toLowerCase()) return manufacturer;
  return manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);
}

/**
 * The name a person recognises a device by: maker and model ("Xiaomi 24117RN76G"), never a raw
 * serial or address unless nothing else is known. `adb devices -l` writes spaces in the model as
 * underscores, so a handset model is read back with spaces; an emulator keeps its system image
 * name, where underscores are part of the identifier and the maker adds nothing.
 */
export function friendlyDeviceName(device: NamedDevice, manufacturer?: string | null): string {
  const rawModel = device.model?.trim();
  if (!rawModel) return device.serial;
  if (device.deviceKind === "emulator") return rawModel;
  const model = rawModel.replaceAll("_", " ");
  const maker = manufacturer?.trim();
  if (!maker || maker.toLowerCase() === "unknown") return model;
  if (model.toLowerCase().startsWith(maker.toLowerCase())) return model;
  return `${brand(maker)} ${model}`;
}

/**
 * The quiet line that tells two devices with the same name apart: the address of a Wi-Fi device
 * without its port, otherwise the serial.
 */
export function deviceIdentity(device: Pick<ADBDevice, "serial" | "connectionType">): string {
  if (device.connectionType !== "wifi") return device.serial;
  const match = /^(.*):\d+$/.exec(device.serial);
  return match ? match[1] : device.serial;
}
