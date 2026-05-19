import type { Component } from "vue";

/** Tool identifiers — every module that can occupy a tab. */
export type ToolId =
  | "storage"
  | "network"
  | "inspect"
  | "console"
  | "replay"
  | "capacitor"
  | "browser-preview"
  | "settings"
  | "devices"
  | "app";

/** Scope identifies what the tab acts on. */
export type TabScope =
  | { kind: "target"; serial: string; webviewId: string }
  | { kind: "recording"; capuPath: string }
  | { kind: "singleton" };

export interface Tab {
  /** Stable id; survives restarts. */
  id: string;
  tool: ToolId;
  scope: TabScope;
  /** Derived display label; cached so tab strip renders instantly. */
  title: string;
  /** Icon component reference resolved by consumers (not serialized). */
  icon?: Component;
  createdAt: number;
  lastFocusedAt: number;
}

/** Discriminated per-tab state. */
export type TabState =
  | {
      tool: "storage";
      subTool:
        | "idb"
        | "localStorage"
        | "cache"
        | "opfs"
        | "sqlite"
        | "localforage"
        | "graph"
        | "changes"
        | "sqlite-wasm";
    }
  | { tool: "network"; selectedRequestId: string | null }
  | { tool: "inspect"; selectedNodeId: string | null }
  | { tool: "console" }
  | { tool: "replay"; capuPath: string | null }
  | { tool: "capacitor" }
  | { tool: "browser-preview" }
  | { tool: "settings" }
  | { tool: "devices" }
  | { tool: "app" };

export function defaultStateFor(tool: ToolId): TabState {
  switch (tool) {
    case "storage":
      return { tool: "storage", subTool: "idb" };
    case "network":
      return { tool: "network", selectedRequestId: null };
    case "inspect":
      return { tool: "inspect", selectedNodeId: null };
    case "replay":
      return { tool: "replay", capuPath: null };
    case "console":
      return { tool: "console" };
    case "capacitor":
      return { tool: "capacitor" };
    case "browser-preview":
      return { tool: "browser-preview" };
    case "settings":
      return { tool: "settings" };
    case "devices":
      return { tool: "devices" };
    case "app":
      return { tool: "app" };
  }
}

export function scopeKey(scope: TabScope): string {
  switch (scope.kind) {
    case "target":
      return `target:${scope.serial}/${scope.webviewId}`;
    case "recording":
      return `recording:${scope.capuPath}`;
    case "singleton":
      return "singleton";
  }
}

export function tabKey(tool: ToolId, scope: TabScope): string {
  return `${tool}::${scopeKey(scope)}`;
}
