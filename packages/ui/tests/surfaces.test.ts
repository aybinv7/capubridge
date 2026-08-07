import { h } from "vue";
import { expect, test } from "vite-plus/test";

import { Surface, SurfaceCut, UiProvider } from "../src/index.ts";
import SurfaceFixture from "../fixtures/surfaces/SurfaceFixture.vue";
import { byTestId, mountTree } from "./support/mountTree.ts";

test("publishes theme and accent through a native Vue provider", () => {
  const mounted = mountTree(
    h(UiProvider, { accent: "cyan", theme: "light" }, { default: () => "content" }),
  );
  const provider = mounted.root.firstElementChild;

  expect(provider?.getAttribute("data-cui-theme")).toBe("light");
  expect(provider?.getAttribute("data-cui-accent")).toBe("cyan");
  expect(provider?.classList.contains("cui-accent-cyan")).toBe(true);
  mounted.app.unmount();
});

test("uses root context defaults without injection warnings", () => {
  const warnings: string[] = [];
  const mounted = mountTree(
    h(Surface, { "data-testid": "surface" }, { default: () => "content" }),
    (message) => warnings.push(message),
  );

  expect(warnings.filter((message) => message.includes("injection"))).toEqual([]);
  expect(byTestId(mounted.root, "surface").dataset.cuiSurfaceLevel).toBe("1");
  expect(byTestId(mounted.root, "surface").dataset.cuiAccent).toBe("brand");
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

  expect(byTestId(mounted.root, "level-1").dataset.cuiSurfaceLevel).toBe("1");
  expect(byTestId(mounted.root, "level-3").dataset.cuiSurfaceLevel).toBe("3");
  expect(byTestId(mounted.root, "level-5").dataset.cuiSurfaceLevel).toBe("5");
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

  expect(byTestId(mounted.root, "transparent").dataset.cuiSurfaceLevel).toBe("4");
  expect(byTestId(mounted.root, "after-transparent").dataset.cuiSurfaceLevel).toBe("4");
  expect(byTestId(mounted.root, "cut").dataset.cuiSurfaceCutFromLevel).toBe("3");
  expect(byTestId(mounted.root, "after-cut").dataset.cuiSurfaceLevel).toBe("3");
  mounted.app.unmount();
});

test("scopes explicit accents without adding them to siblings", () => {
  const mounted = mountTree(
    h(
      UiProvider,
      { accent: "brand" },
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

  expect(accented.classList.contains("cui-accent-red")).toBe(true);
  expect(sibling.classList.contains("cui-accent-red")).toBe(false);
  expect(sibling.dataset.cuiAccent).toBe("brand");
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
  const themes = mounted.root.querySelectorAll(".cui-theme");

  expect(themes).toHaveLength(2);
  expect(themes[0]?.getAttribute("data-cui-theme")).toBe("dark");
  expect(themes[1]?.getAttribute("data-cui-theme")).toBe("light");
  mounted.app.unmount();
});
