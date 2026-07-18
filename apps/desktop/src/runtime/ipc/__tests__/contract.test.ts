import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { IPC_COMMAND_CONTRACT_COMPLETE, IPC_COMMAND_NAMES } from "@/runtime/ipc/contract";

function registeredRustCommands(): string[] {
  const libPath = fileURLToPath(new URL("../../../../src-tauri/src/lib.rs", import.meta.url));
  const source = readFileSync(libPath, "utf8");
  const handler = source.match(/tauri::generate_handler!\[([\s\S]*?)\]\)/)?.[1];
  if (!handler) throw new Error("Tauri command registration was not found");

  return handler
    .split(",")
    .map((command) => command.trim())
    .filter(Boolean)
    .sort();
}

test("covers every registered Rust command exactly once", () => {
  const contractCommands = [...IPC_COMMAND_NAMES].sort();
  const uniqueCommands = [...new Set(contractCommands)];

  expect(IPC_COMMAND_CONTRACT_COMPLETE).toBe(true);
  expect(uniqueCommands).toEqual(contractCommands);
  expect(contractCommands).toEqual(registeredRustCommands());
});
