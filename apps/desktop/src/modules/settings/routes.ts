import type { RouteRecordRaw } from "vue-router";

export const settingsRoutes = [
  {
    path: "/settings",
    component: () => import("./SettingsDialog.vue"),
    redirect: "/settings/appearance",
    children: [
      {
        path: "appearance",
        name: "settings-appearance",
        component: () => import("./SettingsAppearance.vue"),
        meta: { label: "Appearance", keywords: ["theme", "timeline", "rail", "colours"] },
      },
      {
        path: "devices",
        name: "settings-devices",
        component: () => import("./SettingsDevices.vue"),
        meta: { label: "Devices", keywords: ["adb", "chrome", "wi-fi", "wireless", "paired"] },
      },
      {
        path: "screen",
        name: "settings-screen",
        component: () => import("./SettingsScreen.vue"),
        meta: { label: "Screen", keywords: ["mirror", "frame rate", "quality", "bitrate"] },
      },
      {
        path: "shortcuts",
        name: "settings-shortcuts",
        component: () => import("./SettingsShortcuts.vue"),
        meta: { label: "Shortcuts", keywords: ["keyboard", "keys", "bindings", "hotkeys"] },
      },
      {
        path: "mcp",
        name: "settings-mcp",
        component: () => import("./SettingsMcp.vue"),
        meta: { label: "AI access", keywords: ["mcp", "ai", "token", "assistant"] },
      },
      {
        path: "updates",
        name: "settings-updates",
        component: () => import("./SettingsUpdates.vue"),
        meta: { label: "Updates", keywords: ["version", "pre-release", "install"] },
      },
      { path: "general", redirect: { name: "settings-appearance" } },
      { path: "theme", redirect: { name: "settings-appearance" } },
      { path: "adb", redirect: { name: "settings-devices" } },
      { path: "chrome", redirect: { name: "settings-devices" } },
    ],
  },
] satisfies RouteRecordRaw[];
