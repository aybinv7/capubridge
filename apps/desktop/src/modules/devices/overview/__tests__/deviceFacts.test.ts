import { describe, expect, test } from "vite-plus/test";
import type { DeviceOverview } from "@/composables/useAdb";
import { deviceFacts } from "../deviceFacts";

const redmi: DeviceOverview = {
  name: "24117RN76G",
  manufacturer: "Xiaomi",
  model: "24117RN76G · arm64-v8a",
  cpuArch: "arm64-v8a",
  screenDpi: 440,
  apiLevel: 35,
  serial: "r4geda5p7d65u8uo",
  availableStorage: 150 * 1024 ** 3,
  totalStorage: 256 * 1024 ** 3,
  totalRam: 8 * 1024 ** 3,
  screenResolution: "1080x2400",
  ipAddresses: ["192.168.1.20"],
  androidVersion: "15",
};

function byKey(info: DeviceOverview) {
  return Object.fromEntries(deviceFacts(info, info.serial).map((fact) => [fact.key, fact]));
}

describe("deviceFacts", () => {
  test("reads like a person would say it", () => {
    const facts = byKey(redmi);
    expect(facts.model?.value).toBe("Xiaomi 24117RN76G");
    expect(facts.android).toBeUndefined();
    expect(facts.display).toMatchObject({ value: "1080 × 2400", detail: "440 dpi" });
    expect(facts.memory?.value).toBe("8 GB");
    expect(facts.abi).toMatchObject({ value: "arm64-v8a", mono: true });
  });

  test("storage shows what is used, what is free and a meter", () => {
    const storage = byKey(redmi).storage;
    expect(storage?.value).toBe("106 GB of 256 GB used");
    expect(storage?.detail).toBe("150 GB free");
    expect(storage?.meter).toBeCloseTo(41.4, 1);
  });

  test("identifiers are quiet and copyable, and absent when unknown", () => {
    const facts = byKey(redmi);
    expect(facts.serial).toMatchObject({ quiet: true, copy: "r4geda5p7d65u8uo" });
    expect(facts.address).toMatchObject({ quiet: true, label: "Network address" });
    const bare = byKey({ ...redmi, ipAddresses: [], totalStorage: 0, totalRam: 0, cpuArch: "" });
    expect(bare.address).toBeUndefined();
    expect(bare.storage?.value).toBe("—");
    expect(bare.memory?.value).toBe("—");
    expect(bare.abi?.value).toBe("—");
  });

  test("a model that already names its maker is not doubled", () => {
    expect(byKey({ ...redmi, name: "Xiaomi_14T" }).model?.value).toBe("Xiaomi 14T");
  });
});
