import { describe, expect, test } from "vite-plus/test";
import { extractVueScripts, findSilentErrorHandlers } from "./check-silent-errors.mjs";

describe("silent error boundary", () => {
  test("rejects empty catch clauses", () => {
    const violations = findSilentErrorHandlers("try { work() } catch {}", "sample.ts");
    expect(violations).toEqual([
      expect.objectContaining({ filename: "sample.ts", kind: "empty catch clause" }),
    ]);
  });

  test("rejects empty and undefined Promise catch handlers", () => {
    const source = `
      task.catch(() => {});
      task.catch(() => null);
      task.catch(() => undefined);
      task.catch(function () { return; });
    `;
    const violations = findSilentErrorHandlers(source, "sample.ts");
    expect(violations).toHaveLength(4);
    expect(violations.every((entry) => entry.kind === "silent Promise.catch handler")).toBe(true);
  });

  test("accepts explicit reporting, recovery, state updates, and rethrows", () => {
    const source = `
      try { work() } catch (error) { console.warn(error); }
      try { work() } catch (error) { state.error = String(error); }
      try { work() } catch (error) { throw error; }
      task.catch((error) => console.warn(error));
      task.catch(() => 0);
    `;
    expect(findSilentErrorHandlers(source, "sample.ts")).toEqual([]);
  });

  test("extracts top-level Vue script blocks without inspecting template strings", () => {
    const source = `<script setup lang="ts">
const markup = "<script></script>";
try { work() } catch {}
</script>
<template><div /></template>`;
    const scripts = extractVueScripts(source);
    expect(scripts).toHaveLength(1);
    expect(findSilentErrorHandlers(scripts[0].source, "Sample.vue", scripts[0].startLine)).toEqual([
      expect.objectContaining({ line: 3, kind: "empty catch clause" }),
    ]);
  });
});
