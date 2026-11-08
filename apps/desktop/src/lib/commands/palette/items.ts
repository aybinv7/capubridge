import type { Component } from "vue";
import type { Command, PaletteSection } from "../types";

export type PaletteSectionId = PaletteSection | "recent";

/** An installed app as the palette lists it. */
export interface PaletteApp {
  serial: string;
  packageName: string;
  apkPath: string;
  iconPath: string | null;
  label: string | null;
  system: boolean;
}

export type PaletteItem =
  | {
      kind: "command";
      key: string;
      section: PaletteSectionId;
      title: string;
      subtitle: string | null;
      icon: Component | null;
      binding: string | null;
      note: (() => string | null) | null;
      command: Command;
    }
  | {
      kind: "app";
      key: string;
      section: "apps";
      title: string;
      subtitle: string;
      app: PaletteApp;
    }
  | {
      kind: "notice";
      key: string;
      section: PaletteSectionId;
      title: string;
      subtitle: string | null;
      action: (() => void) | null;
    };

export interface PaletteSectionView {
  id: PaletteSectionId;
  label: string;
  items: PaletteItem[];
}

export const SECTION_LABELS: Record<PaletteSectionId, string> = {
  recent: "Recent",
  "go-to": "Go to",
  apps: "Apps",
  switch: "Devices and targets",
  tables: "Tables and stores",
  actions: "Actions",
};

export const SECTION_ORDER: readonly PaletteSectionId[] = [
  "recent",
  "go-to",
  "apps",
  "switch",
  "actions",
  "tables",
];

/** The section a command is listed under. */
export function sectionOf(command: Command): PaletteSection {
  if (command.section) return command.section;
  return command.group === "Navigate" ? "go-to" : "actions";
}

export function appTitle(app: Pick<PaletteApp, "label" | "packageName">): string {
  const label = app.label?.trim();
  return label ? label : app.packageName;
}

export function commandItem(command: Command, section: PaletteSectionId): PaletteItem {
  const detail = command.detail ?? (section === "actions" ? command.group : null);
  return {
    kind: "command",
    key: `command:${command.id}`,
    section,
    title: command.title,
    subtitle: detail ?? null,
    icon: command.icon ?? null,
    binding: command.binding ?? null,
    note: command.note ?? null,
    command,
  };
}

export function appItem(app: PaletteApp): PaletteItem {
  return {
    kind: "app",
    key: `app:${app.serial}:${app.packageName}`,
    section: "apps",
    title: appTitle(app),
    subtitle: app.packageName,
    app,
  };
}
