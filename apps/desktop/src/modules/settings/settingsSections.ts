import type { Component } from "vue";
import { Bot, Download, Keyboard, MonitorSmartphone, Palette, Smartphone } from "lucide-vue-next";

export type SettingsSectionId =
  | "appearance"
  | "devices"
  | "screen"
  | "shortcuts"
  | "mcp"
  | "updates";

export interface SettingsSectionEntry {
  id: SettingsSectionId;
  routeName: `settings-${SettingsSectionId}`;
  label: string;
  path: `/settings/${SettingsSectionId}`;
  icon: Component;
}

function entry(id: SettingsSectionId, label: string, icon: Component): SettingsSectionEntry {
  return { id, routeName: `settings-${id}`, label, path: `/settings/${id}`, icon };
}

/** The sections of Settings, in the order the list shows them. */
export const SETTINGS_SECTIONS: readonly SettingsSectionEntry[] = [
  entry("appearance", "Appearance", Palette),
  entry("devices", "Devices", Smartphone),
  entry("screen", "Screen", MonitorSmartphone),
  entry("shortcuts", "Shortcuts", Keyboard),
  entry("mcp", "AI access", Bot),
  entry("updates", "Updates", Download),
];
