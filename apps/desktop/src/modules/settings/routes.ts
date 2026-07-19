import type { RouteRecordRaw } from "vue-router";

export const settingsRoutes = [
  {
    path: "/settings",
    component: () => import("./SettingsModal.vue"),
    redirect: "/settings/general",
    children: [
      {
        path: "general",
        name: "settings-general",
        component: () => import("./SettingsGeneral.vue"),
        meta: { label: "General" },
      },
      {
        path: "appearance",
        name: "settings-appearance",
        component: () => import("./SettingsAppearance.vue"),
        meta: { label: "Appearance" },
      },
      {
        path: "adb",
        name: "settings-adb",
        component: () => import("./SettingsAdb.vue"),
        meta: { label: "ADB" },
      },
      {
        path: "chrome",
        name: "settings-chrome",
        component: () => import("./SettingsChrome.vue"),
        meta: { label: "Chrome" },
      },
      {
        // Back-compat: older deep links to /settings/theme land on Appearance.
        path: "theme",
        redirect: { name: "settings-appearance" },
      },
      {
        path: "shortcuts",
        name: "settings-shortcuts",
        component: () => import("./SettingsShortcuts.vue"),
        meta: { label: "Shortcuts" },
      },
      {
        path: "updates",
        name: "settings-updates",
        component: () => import("./SettingsUpdates.vue"),
        meta: { label: "Updates" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
