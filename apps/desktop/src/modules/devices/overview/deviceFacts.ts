import type { DeviceOverview } from "@/composables/useAdb";
import type { Fact } from "@/shared/facts/fact";
import { formatBytes, share } from "@/shared/format/numbers";

function maker(manufacturer: string): string {
  const trimmed = manufacturer.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function modelLine(info: DeviceOverview): string {
  const model = info.name.replaceAll("_", " ").trim();
  const brand = maker(info.manufacturer);
  if (!model) return "—";
  if (!brand || model.toLowerCase().startsWith(brand.toLowerCase())) return model;
  return `${brand} ${model}`;
}

function displayLine(resolution: string): string {
  const match = /^(\d+)\s*x\s*(\d+)$/i.exec(resolution.trim());
  return match ? `${match[1]} × ${match[2]}` : resolution.trim() || "—";
}

/**
 * Turns the device's own report into the facts a developer reads, in reading order. The Android
 * version is left to the header, which names it next to the connection.
 */
export function deviceFacts(info: DeviceOverview, serial: string): Fact[] {
  const facts: Fact[] = [
    { key: "model", label: "Model", value: modelLine(info) },
    { key: "abi", label: "Processor", value: info.cpuArch || "—", mono: Boolean(info.cpuArch) },
    {
      key: "display",
      label: "Display",
      value: displayLine(info.screenResolution),
      detail: info.screenDpi > 0 ? `${info.screenDpi} dpi` : undefined,
    },
    { key: "memory", label: "Memory", value: info.totalRam > 0 ? formatBytes(info.totalRam) : "—" },
  ];

  if (info.totalStorage > 0) {
    const used = Math.max(0, info.totalStorage - info.availableStorage);
    facts.push({
      key: "storage",
      label: "Storage",
      value: `${formatBytes(used)} of ${formatBytes(info.totalStorage)} used`,
      detail: `${formatBytes(info.availableStorage)} free`,
      meter: share(used, info.totalStorage) ?? undefined,
    });
  } else {
    facts.push({ key: "storage", label: "Storage", value: "—" });
  }

  if (info.ipAddresses.length > 0) {
    facts.push({
      key: "address",
      label: info.ipAddresses.length > 1 ? "Network addresses" : "Network address",
      value: info.ipAddresses.join(", "),
      mono: true,
      quiet: true,
      copy: info.ipAddresses.join(", "),
    });
  }

  if (serial) {
    facts.push({
      key: "serial",
      label: "Serial",
      value: serial,
      mono: true,
      quiet: true,
      copy: serial,
    });
  }

  return facts;
}
