import { expect, test } from "vite-plus/test";
import type { PairingFailure } from "@/types/wireless.types";
import { failureCopy, phaseLabel } from "../pairingCopy";

const REASONS: PairingFailure[] = [
  "phoneNotSeen",
  "nothingDiscovered",
  "phoneUnreachable",
  "pairingRejected",
  "connectFailed",
  "discoveryUnavailable",
  "adbUnavailable",
];

test("every failure has a title, an explanation and something to try", () => {
  for (const reason of REASONS) {
    const copy = failureCopy(reason);
    expect(copy.title.length).toBeGreaterThan(0);
    expect(copy.body.length).toBeGreaterThan(0);
    expect(copy.hints.length).toBeGreaterThan(0);
    expect(copy.title).not.toMatch(/!/);
  }
});

test("blocked discovery names the network and the firewall", () => {
  const hints = failureCopy("nothingDiscovered").hints.join(" ");
  expect(hints).toMatch(/same Wi-Fi/);
  expect(hints).toMatch(/Guest/);
  expect(hints).toMatch(/firewall/);
});

test("phases read as plain words", () => {
  expect(phaseLabel(null)).toBe("Waiting for the phone");
  expect(phaseLabel({ phase: "pairing" })).toBe("Pairing");
  expect(phaseLabel({ phase: "connected", serial: "x", guid: null })).toBe("Connected");
});
