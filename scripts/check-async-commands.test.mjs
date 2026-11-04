import { describe, expect, test } from "vite-plus/test";
import { findSyncCommands } from "./check-async-commands.mjs";

describe("async command boundary", () => {
  test("rejects synchronous tauri commands with their declaration line", () => {
    const source = [
      "#[tauri::command]",
      "pub fn list_devices() -> Result<(), String> {",
      "    Ok(())",
      "}",
    ].join("\n");
    expect(findSyncCommands(source, "sample.rs")).toEqual([
      expect.objectContaining({ filename: "sample.rs", line: 2 }),
    ]);
  });

  test("accepts async commands across attributes, doc comments, and visibility", () => {
    const source = [
      '#[tauri::command(rename_all = "snake_case")]',
      "/// Lists devices.",
      '#[cfg(target_os = "windows")]',
      "pub(crate) async fn list_devices() -> Result<(), String> {",
      "    Ok(())",
      "}",
      "#[tauri::command]",
      "async fn private_command() {}",
    ].join("\n");
    expect(findSyncCommands(source, "sample.rs")).toEqual([]);
  });

  test("rejects sync commands hidden behind multi-line attributes", () => {
    const source = [
      "#[tauri::command(",
      "    async",
      ")]",
      "#[allow(",
      "    clippy::too_many_arguments",
      ")]",
      "fn blocking_command() {}",
    ].join("\n");
    expect(findSyncCommands(source, "sample.rs")).toEqual([expect.objectContaining({ line: 7 })]);
  });
});
