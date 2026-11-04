// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createApp, h, nextTick, type App } from "vue";
import type { CDPTarget } from "@/types/cdp.types";
import { presentLink } from "@/lib/gates/link";
import TargetAppGroup from "../TargetAppGroup.vue";
import { moveRovingFocus } from "../rovingFocus";
import { groupTargetsByApp } from "../targetGroups";

function target(id: string, type: CDPTarget["type"] = "page"): CDPTarget {
  return { id, type, title: `${id} title`, url: `https://localhost/${id}`, source: "adb" };
}

let app: App | null = null;
let root: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  root?.remove();
  app = null;
  root = null;
});

async function mount(targets: CDPTarget[], selectedTargetId: string | null) {
  const [group] = groupTargetsByApp(targets, selectedTargetId);
  const selected: string[] = [];
  root = document.createElement("div");
  root.id = "app";
  document.body.append(root);
  app = createApp({
    render: () =>
      h(TargetAppGroup, {
        group,
        serial: "R58",
        appLabel: null,
        apkPath: "",
        iconPath: null,
        selectedTargetId,
        link: presentLink("live"),
        onSelect: (entry: CDPTarget) => selected.push(entry.id),
      }),
  });
  app.mount(root);
  await nextTick();
  return { root, selected };
}

function rowButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button[data-roving-item]"));
}

describe("TargetAppGroup", () => {
  it("shows pages and keeps workers behind a disclosure", async () => {
    const { root: container } = await mount(
      [target("p1"), target("w1", "worker"), target("w2", "worker")],
      null,
    );
    expect(container.textContent).toContain("Other WebViews");
    expect(container.textContent).toContain("p1 title");
    expect(container.textContent).not.toContain("w1 title");

    const toggle = rowButtons(container).at(-1);
    expect(toggle?.textContent).toContain("Show 2 workers and frames");
    toggle?.click();
    await nextTick();
    expect(container.textContent).toContain("w1 title");
    expect(container.textContent).toContain("Hide 2 workers and frames");
  });

  it("marks the selected target as current with its link state, even when it is a worker", async () => {
    const { root: container } = await mount([target("p1"), target("w1", "worker")], "w1");
    const current = container.querySelector('[aria-current="true"]');
    expect(current?.textContent).toContain("w1 title");
    expect(current?.textContent).toContain("live");
    expect(container.textContent).toContain("In use");
  });

  it("emits select for the clicked row", async () => {
    const { root: container, selected } = await mount([target("p1"), target("p2")], null);
    rowButtons(container)[1]?.click();
    expect(selected).toEqual(["p2"]);
  });

  it("moves focus between rows with the arrow keys", async () => {
    const { root: container } = await mount([target("p1"), target("p2"), target("p3")], null);
    const rows = rowButtons(container);
    rows[0].focus();
    expect(moveRovingFocus(container, "ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(rows[1]);
    moveRovingFocus(container, "End");
    expect(document.activeElement).toBe(rows[2]);
    moveRovingFocus(container, "ArrowDown");
    expect(document.activeElement).toBe(rows[0]);
    expect(moveRovingFocus(container, "Enter")).toBe(false);
  });
});
