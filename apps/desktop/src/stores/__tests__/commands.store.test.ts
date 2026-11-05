import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useCommandsStore } from "../commands.store";
import type { Command } from "@/lib/commands/types";

function command(id: string): Command {
  return { id, title: id, group: "View", run: () => undefined };
}

describe("commands store providers", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("keeps a re-registered provider when the old registration is disposed late", () => {
    const store = useCommandsStore();
    const disposeOld = store.registerProvider("core", () => [command("old")]);
    store.registerProvider("core", () => [command("new")]);
    disposeOld();
    expect(store.available.map((entry) => entry.id)).toEqual(["new"]);
  });

  it("removes its own provider", () => {
    const store = useCommandsStore();
    const dispose = store.registerProvider("core", () => [command("only")]);
    dispose();
    expect(store.available).toEqual([]);
  });
});
