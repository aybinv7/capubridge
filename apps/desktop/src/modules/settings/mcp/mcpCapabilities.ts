import type { McpCapability } from "@/types/mcp.types";

export const CAPABILITY_LABEL: Record<McpCapability, string> = {
  read: "Read",
  execute: "Execute",
  authorize: "Authorize",
  administer: "Administer",
};

/** The permissions a client can be given, mildest first, with what each one lets it do. */
export const CAPABILITY_OPTIONS: readonly { id: McpCapability; hint: string }[] = [
  { id: "read", hint: "Read storage, console, network and screenshots" },
  { id: "execute", hint: "Tap, type, launch apps and run JavaScript on the device" },
  { id: "authorize", hint: "Start automation runs" },
  { id: "administer", hint: "Run any shell command on the device" },
];
