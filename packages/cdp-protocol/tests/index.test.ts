import { expect, test } from "vite-plus/test";
import { CDPClient, fetchLocalTargets, IDBDomain } from "../src/index.ts";

test("exports CDPClient class", () => {
  expect(CDPClient).toBeDefined();
  expect(typeof CDPClient).toBe("function");
});

test("exports fetchLocalTargets function", () => {
  expect(typeof fetchLocalTargets).toBe("function");
});

test("exports IDBDomain class", () => {
  expect(IDBDomain).toBeDefined();
  expect(typeof IDBDomain).toBe("function");
});
