import { describe, expect, test } from "vite-plus/test";
import { groundAppPackage } from "../appGrounding";

const INSTALLED = [
  "com.presalio.app.dev",
  "com.presalio.app",
  "com.presalio.app.danone.dda",
  "com.presalio.app.staging",
  "io.capucho.inv.staging",
  "com.example.app",
];

describe("groundAppPackage", () => {
  test("dotted input passes through untouched", () => {
    expect(groundAppPackage("com.example.app", INSTALLED)).toBe("com.example.app");
  });

  test("bare presalio grounds to the shortest launchable base package", () => {
    expect(groundAppPackage("presalio", INSTALLED)).toBe("com.presalio.app");
  });

  test("natural-language app spans ignore launch words", () => {
    expect(groundAppPackage("open presalio app", INSTALLED)).toBe("com.presalio.app");
  });

  test("staging grounds to the installed staging build", () => {
    expect(groundAppPackage("staging", INSTALLED)).toBe("io.capucho.inv.staging");
  });

  test("unknown app returns null so the caller falls back to raw", () => {
    expect(groundAppPackage("no-such-app-xyz", INSTALLED)).toBeNull();
  });

  test("empty input returns null", () => {
    expect(groundAppPackage("   ", INSTALLED)).toBeNull();
  });
});
