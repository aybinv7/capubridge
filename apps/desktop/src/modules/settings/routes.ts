import type { RouteRecordRaw } from "vue-router";

export const settingsRoutes = [
  {
    path: "/settings",
    component: () => import("./SettingsPanel.vue"),
    redirect: "/settings/theme",
    children: [
      {
        path: "theme",
        name: "settings-theme",
        component: () => import("./SettingsTheme.vue"),
        meta: { label: "Theme" },
      },
      {
        path: "shortcuts",
        name: "settings-shortcuts",
        component: () => import("./SettingsShortcuts.vue"),
        meta: { label: "Shortcuts" },
      },
    ],
  },
] satisfies RouteRecordRaw[];
