import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { MAX_RECENT_APPS, MAX_RECENT_COMMANDS, pushRecent } from "@/lib/commands/recents";
import type { Command } from "@/lib/commands/types";
import { installMemoryStorage } from "@/test/memory-storage";
import { useCommandsStore } from "../commands.store";

function command(id: string): Command {
  return { id, title: id, group: "View", run: vi.fn() };
}

describe("pushRecent", () => {
  test("puts the newest first without repeats and caps the list", () => {
    expect(pushRecent(["a", "b", "c"], "b", 5)).toEqual(["b", "a", "c"]);
    expect(pushRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });
});

describe("recents in the commands store", () => {
  beforeEach(() => {
    installMemoryStorage();
    setActivePinia(createPinia());
  });

  test("a run command is remembered, newest first, and survives a restart", async () => {
    const store = useCommandsStore();
    store.registerProvider("t", () => [command("one"), command("two")]);
    await store.run(command("one"));
    await store.run(command("two"));
    expect(store.recent.map((entry) => entry.id)).toEqual(["two", "one"]);

    setActivePinia(createPinia());
    const restarted = useCommandsStore();
    restarted.registerProvider("t", () => [command("one"), command("two")]);
    expect(restarted.recent.map((entry) => entry.id)).toEqual(["two", "one"]);
  });

  test("recents are capped", async () => {
    const store = useCommandsStore();
    const all = Array.from({ length: MAX_RECENT_COMMANDS + 4 }, (_, index) => command(`c${index}`));
    store.registerProvider("t", () => all);
    for (const entry of all) await store.run(entry);
    expect(store.recent).toHaveLength(MAX_RECENT_COMMANDS);
  });

  test("the palette command itself is not remembered", async () => {
    const store = useCommandsStore();
    store.registerProvider("t", () => [command("view.palette")]);
    await store.run(command("view.palette"));
    expect(store.recent).toEqual([]);
  });

  test("a recent command that is no longer offered drops out", async () => {
    const store = useCommandsStore();
    const dispose = store.registerProvider("t", () => [command("gone")]);
    await store.run(command("gone"));
    dispose();
    expect(store.recent).toEqual([]);
  });

  test("opened apps are remembered, capped and persisted", () => {
    const store = useCommandsStore();
    for (let index = 0; index < MAX_RECENT_APPS + 3; index += 1) {
      store.rememberApp(`com.app${index}`);
    }
    store.rememberApp("com.app5");
    expect(store.recentApps).toHaveLength(MAX_RECENT_APPS);
    expect(store.recentApps[0]).toBe("com.app5");

    setActivePinia(createPinia());
    expect(useCommandsStore().recentApps[0]).toBe("com.app5");
  });

  test("a corrupt stored list falls back to empty", () => {
    localStorage.setItem("capubridge:recent-commands", "{not json");
    localStorage.setItem("capubridge:recent-apps", JSON.stringify([1, 2]));
    const store = useCommandsStore();
    expect(store.recentApps).toEqual([]);
    expect(store.recent).toEqual([]);
  });

  test("a screen's command replaces an app-wide one with the same id", () => {
    const store = useCommandsStore();
    const shell = command("app.restart");
    const screen = { ...command("app.restart"), screen: true };
    store.registerProvider("shell", () => [shell, command("other")]);
    store.registerProvider("screen", () => [screen]);
    expect(store.commands.map((entry) => entry.id)).toEqual(["app.restart", "other"]);
    expect(store.commands[0]).toBe(screen);
  });
});
