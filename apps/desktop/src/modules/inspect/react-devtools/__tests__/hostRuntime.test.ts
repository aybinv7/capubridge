// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import { describe, test, expect } from "vite-plus/test";
import { HOST_READY_FLAG, buildCommonJsShimSource, buildFrameHtml } from "../hostRuntime";

const require_ = createRequire(import.meta.url);
const standaloneSource = readFileSync(
  require_.resolve("react-devtools-core/dist/standalone.js"),
  "utf8",
);

describe("buildFrameHtml", () => {
  test("loads the shim before the bundle, since the bundle needs require at load", () => {
    const html = buildFrameHtml("/devtools-standalone.js");
    expect(html.indexOf("w.require =")).toBeLessThan(html.indexOf("/devtools-standalone.js"));
  });

  test("references the bundle by URL rather than inlining 1.5MB", () => {
    const html = buildFrameHtml("/devtools-standalone.js");
    expect(html).toContain('src="/devtools-standalone.js"');
    expect(html.length).toBeLessThan(20_000);
  });

  test("publishes a readiness flag the host can poll", () => {
    expect(buildFrameHtml("/x.js")).toContain(HOST_READY_FLAG);
  });
});

describe("the official DevTools UI bundle under our shim", () => {
  // The load-bearing test: standalone.js is built for a Node/Electron renderer
  // and has `const CS = require("child_process")` at module scope, so it cannot
  // be loaded raw in a browser. If this passes, the iframe approach is viable.
  test("evaluates and exposes connectToSocket + setContentDOMNode", () => {
    runInThisContext(buildCommonJsShimSource());

    const w = globalThis as unknown as {
      module: { exports: Record<string, unknown> };
      require: (id: string) => unknown;
    };
    expect(typeof w.require).toBe("function");

    runInThisContext(standaloneSource);

    // The bundle exports an ESM-interop namespace, so the UI sits on .default.
    const raw = w.module.exports as Record<string, unknown>;
    const ui = (typeof raw.connectToSocket === "function" ? raw : raw.default) as Record<
      string,
      unknown
    >;
    expect(ui).toBeTruthy();
    expect(typeof ui.connectToSocket).toBe("function");
    expect(typeof ui.setContentDOMNode).toBe("function");
    // startServer exists but must never be called: it needs a real net listener.
    expect(typeof ui.startServer).toBe("function");
  });
});

describe("buildCommonJsShimSource", () => {
  test("stubs the module-scope require the bundle performs", () => {
    const shim = buildCommonJsShimSource();
    expect(shim).toContain("child_process");
    expect(shim).toContain("process");
  });

  test("makes the server-only stubs throw rather than silently no-op", () => {
    // A silent no-op would turn "we called the wrong entry point" into a hang.
    expect(buildCommonJsShimSource()).toContain("is not available in the panel");
  });
});
