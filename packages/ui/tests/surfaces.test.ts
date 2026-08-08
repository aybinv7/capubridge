import { defineComponent, h } from "vue";
import { expect, test } from "vite-plus/test";

import { Surface, SurfaceCut, UiProvider, useUiContext } from "../src/index.ts";
import SurfaceFixture from "../fixtures/surfaces/SurfaceFixture.vue";
import { byTestId, mountTree } from "./support/mountTree.ts";

test("publishes theme and accent as context without rendering an element", () => {
  const probe = defineComponent({
    setup() {
      const ui = useUiContext();
      return () =>
        h("span", {
          "data-accent": ui.accentColor.value,
          "data-overlays-root": ui.overlaysRoot.value,
          "data-testid": "probe",
          "data-theme": ui.theme.value,
        });
    },
  });
  const mounted = mountTree(
    h(UiProvider, { accentColor: "cyan", theme: "light" }, { default: () => h(probe) }),
  );

  // Upstream's CladdProvider renders no DOM node — the probe is the provider's only output.
  expect(mounted.root.children).toHaveLength(1);
  const rendered = byTestId(mounted.root, "probe");

  expect(rendered.tagName).toBe("SPAN");
  expect(rendered.dataset.theme).toBe("light");
  expect(rendered.dataset.accent).toBe("cyan");
  expect(rendered.dataset.overlaysRoot).toBe("#app, #__next, #root");
  mounted.app.unmount();
});

test("uses root context defaults without injection warnings", () => {
  const warnings: string[] = [];
  const mounted = mountTree(
    h(Surface, { "data-testid": "surface" }, { default: () => "content" }),
    (message) => warnings.push(message),
  );

  expect(warnings.filter((message) => message.includes("injection"))).toEqual([]);
  expect(byTestId(mounted.root, "surface").classList.contains("cui-surface-level-1")).toBe(true);
  expect(byTestId(mounted.root, "surface").className).not.toContain("cui-color-");
  mounted.app.unmount();
});

test("resolves nested, relative, and clamped surface levels", () => {
  const mounted = mountTree(
    h(UiProvider, null, {
      default: () =>
        h(
          Surface,
          { "data-testid": "level-1" },
          {
            default: () =>
              h(
                Surface,
                { "data-testid": "level-3", level: "+2" },
                {
                  default: () => h(Surface, { "data-testid": "level-5", level: "+20" }),
                },
              ),
          },
        ),
    }),
  );

  expect(byTestId(mounted.root, "level-1").classList.contains("cui-surface-level-1")).toBe(true);
  expect(byTestId(mounted.root, "level-3").classList.contains("cui-surface-level-3")).toBe(true);
  expect(byTestId(mounted.root, "level-5").classList.contains("cui-surface-level-5")).toBe(true);
  mounted.app.unmount();
});

test("keeps transparent groups and recessed cuts at their parent depth", () => {
  const mounted = mountTree(
    h(
      Surface,
      { "data-testid": "outer", level: 3 },
      {
        default: () => [
          h(
            Surface,
            { "data-testid": "transparent", variant: "transparent" },
            {
              default: () => h(Surface, { "data-testid": "after-transparent" }),
            },
          ),
          h(
            SurfaceCut,
            { "data-testid": "cut" },
            {
              default: () => h(Surface, { "data-testid": "after-cut" }),
            },
          ),
        ],
      },
    ),
  );

  expect(byTestId(mounted.root, "transparent").classList.contains("cui-surface-level-4")).toBe(
    true,
  );
  expect(
    byTestId(mounted.root, "after-transparent").classList.contains("cui-surface-level-4"),
  ).toBe(true);
  expect(byTestId(mounted.root, "cut").classList.contains("cui-surface-cut")).toBe(true);
  expect(byTestId(mounted.root, "after-cut").classList.contains("cui-surface-level-3")).toBe(true);
  mounted.app.unmount();
});

test("scopes explicit accents without adding them to siblings", () => {
  const mounted = mountTree(
    h(
      UiProvider,
      { accentColor: "brand" },
      {
        default: () => [
          h(Surface, { accent: "red", "data-testid": "accented" }),
          h(Surface, { "data-testid": "sibling" }),
        ],
      },
    ),
  );
  const accented = byTestId(mounted.root, "accented");
  const sibling = byTestId(mounted.root, "sibling");

  expect(accented.classList.contains("cui-color-red")).toBe(true);
  expect(sibling.classList.contains("cui-color-red")).toBe(false);
  expect(sibling.className).not.toContain("cui-color-");
  mounted.app.unmount();
});

test("forwards native attributes and preserves phrasing content", () => {
  const mounted = mountTree(
    h(
      Surface,
      {
        as: "button",
        clickable: true,
        "data-testid": "button",
        type: "button",
      },
      { default: () => "Save" },
    ),
  );
  const button = byTestId(mounted.root, "button");

  expect(button.tagName).toBe("BUTTON");
  expect(button.getAttribute("type")).toBe("button");
  expect(button.querySelector(".cui-surface__content")?.tagName).toBe("SPAN");
  mounted.app.unmount();
});

test("renders the isolated dark and light consumer fixture", () => {
  const mounted = mountTree(h(SurfaceFixture));
  const shells = mounted.root.querySelectorAll(".cui-fixture-shell");

  // The app owns the cascade classes, exactly as a Cladd app does.
  expect(shells).toHaveLength(2);
  expect(shells[0]?.classList.contains("dark")).toBe(true);
  expect(shells[1]?.classList.contains("light")).toBe(true);
  expect(shells[0]?.classList.contains("cui-color-cyan")).toBe(true);
  mounted.app.unmount();
});
