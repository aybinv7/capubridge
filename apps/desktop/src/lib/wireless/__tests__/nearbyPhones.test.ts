import { describe, expect, test } from "vite-plus/test";
import type { ADBDevice } from "@/types/adb.types";
import type { MdnsService } from "@/types/wireless.types";
import { codePairingServices, guidFromSerial, nearbyPhones } from "@/lib/wireless/nearbyPhones";

function device(serial: string, status: ADBDevice["status"] = "online"): ADBDevice {
  return {
    serial,
    model: "Pixel_8",
    product: "shiba",
    transportId: "1",
    deviceKind: "physical",
    connectionType: "wifi",
    status,
  };
}

const connect: MdnsService = {
  name: "adb-R5CR10-Xy12Ab",
  kind: "connect",
  host: "192.168.1.20",
  port: 41235,
};

describe("guidFromSerial", () => {
  test("strips the connect service suffix", () => {
    expect(guidFromSerial("adb-R5CR10-Xy12Ab._adb-tls-connect._tcp")).toBe("adb-R5CR10-Xy12Ab");
  });

  test("an address serial has no guid", () => {
    expect(guidFromSerial("192.168.1.20:41235")).toBeNull();
    expect(guidFromSerial("r4geda5p7d65u8uo")).toBeNull();
  });
});

describe("nearbyPhones", () => {
  test("lists connect services only", () => {
    const pairing: MdnsService = { ...connect, name: "studio-x", kind: "pairing" };
    expect(nearbyPhones([connect, pairing], []).map((phone) => phone.guid)).toEqual([connect.name]);
  });

  test("marks a phone connected under its mDNS serial or its address", () => {
    const byGuid = nearbyPhones([connect], [device(`${connect.name}._adb-tls-connect._tcp`)]);
    expect(byGuid[0]?.connectedSerial).toBe(`${connect.name}._adb-tls-connect._tcp`);
    const byAddress = nearbyPhones([connect], [device("192.168.1.20:41235")]);
    expect(byAddress[0]?.connectedSerial).toBe("192.168.1.20:41235");
  });

  test("an offline or stale device does not count as connected", () => {
    const offline = nearbyPhones([connect], [device("192.168.1.20:41235", "offline")]);
    expect(offline[0]?.connectedSerial).toBeNull();
    const stale = nearbyPhones([connect], [{ ...device("192.168.1.20:41235"), isStale: true }]);
    expect(stale[0]?.connectedSerial).toBeNull();
  });
});

describe("codePairingServices", () => {
  test("keeps phones showing a pairing code and drops QR sessions", () => {
    const code: MdnsService = { ...connect, kind: "pairing", port: 37001 };
    const qr: MdnsService = { ...connect, name: "studio-AbC", kind: "pairing" };
    expect(codePairingServices([connect, code, qr])).toEqual([code]);
  });
});
