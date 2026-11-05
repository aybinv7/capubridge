import type { ADBDevice } from "@/types/adb.types";

export type NamedDevice = Pick<ADBDevice, "model" | "serial"> &
  Partial<Pick<ADBDevice, "deviceKind">>;

function brand(manufacturer: string): string {
  if (manufacturer !== manufacturer.toLowerCase()) return manufacturer;
  return manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);
}

/**
 * One shell call that reads everything a device says about its own name, answers split by `::`:
 * the maker, the marketing name properties that vendors use, then the name shown in Settings.
 */
export const DEVICE_NAMING_COMMAND = [
  "getprop ro.product.manufacturer",
  "getprop ro.product.marketname",
  "getprop ro.product.vendor.marketname",
  "getprop ro.product.odm.marketname",
  "getprop ro.vendor.oplus.market.name",
  "getprop ro.config.marketing_name",
  "settings get global device_name",
].join("; echo ::; ");

export interface DeviceNaming {
  manufacturer: string;
  /** The name the device is sold under ("Redmi Note 14"), empty when it does not say. */
  marketName: string;
}

function meaningful(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed === "null" ? "" : trimmed;
}

/**
 * Reads the answer to {@link DEVICE_NAMING_COMMAND}. A vendor marketing property wins over the
 * Settings name, which the owner may have renamed.
 */
export function parseDeviceNaming(output: string): DeviceNaming {
  const answers = output.split("::").map((answer) => meaningful(answer));
  const [manufacturer = "", ...names] = answers;
  return { manufacturer, marketName: names.find(Boolean) ?? "" };
}

/**
 * The name a person recognises a device by: what it is sold as ("Redmi Note 14") when the device
 * says, otherwise maker and model ("Xiaomi 24117RN76G"), never a raw serial or address unless
 * nothing else is known. `adb devices -l` writes spaces in the model as underscores, so a handset
 * model is read back with spaces; an emulator keeps its system image name, where underscores are
 * part of the identifier and the maker adds nothing.
 */
export function friendlyDeviceName(
  device: NamedDevice,
  manufacturer?: string | null,
  marketName?: string | null,
): string {
  const rawModel = device.model?.trim();
  if (!rawModel) return device.serial;
  if (device.deviceKind === "emulator") return rawModel;
  const market = marketName?.trim();
  if (market) return market;
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
