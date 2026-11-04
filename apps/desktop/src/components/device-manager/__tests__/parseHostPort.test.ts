import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/composables/useAdb", () => ({ useAdb: () => ({}) }));
vi.mock("@/stores/devices.store", () => ({ useDevicesStore: () => ({}) }));

const { parseHostPort } = await import("../useDeviceConnections");

describe("parseHostPort", () => {
  it("splits an IPv4 address and port", () => {
    expect(parseHostPort(" 192.168.1.20:37261 ")).toEqual({ host: "192.168.1.20", port: 37261 });
  });

  it("splits on the last colon so a serial like host:port round-trips", () => {
    expect(parseHostPort("adb-R58.local:5555")).toEqual({ host: "adb-R58.local", port: 5555 });
  });

  it.each(["192.168.1.20", ":5555", "192.168.1.20:", "host:0", "host:70000", "host:12a"])(
    "rejects %s",
    (value) => {
      expect(parseHostPort(value)).toBeNull();
    },
  );
});
