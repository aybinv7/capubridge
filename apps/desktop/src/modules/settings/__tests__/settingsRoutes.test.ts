import { describe, expect, test } from "vite-plus/test";
import { createMemoryHistory, createRouter } from "vue-router";
import { settingsRoutes } from "../routes";
import { SETTINGS_SECTIONS } from "../settingsSections";

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<div />" } }, ...settingsRoutes],
  });
}

describe("settings routes", () => {
  test("every section in the list has its route", () => {
    const names = settingsRoutes[0].children.map((child) => ("name" in child ? child.name : null));
    for (const section of SETTINGS_SECTIONS) expect(names).toContain(section.routeName);
  });

  test.each([
    ["/settings", "settings-appearance"],
    ["/settings/general", "settings-appearance"],
    ["/settings/theme", "settings-appearance"],
    ["/settings/adb", "settings-devices"],
    ["/settings/chrome", "settings-devices"],
    ["/settings/updates", "settings-updates"],
  ])(
    "%s opens %s",
    async (path, name) => {
      const instance = router();
      await instance.push(path);
      expect(instance.currentRoute.value.name).toBe(name);
    },
    30_000,
  );
});
