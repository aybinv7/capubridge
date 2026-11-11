import { describe, expect, test } from "vite-plus/test";
import { inspectorUrlFor, withScreencast } from "../inspectorUrl";

describe("inspectorUrlFor", () => {
  test("points the bundled DevTools at the page's own socket", () => {
    expect(
      inspectorUrlFor("ws://127.0.0.1:57025/devtools/page/E92631E25C560C9429E1E69B4F5774EE"),
    ).toBe(
      "http://127.0.0.1:57025/devtools/inspector.html?ws=127.0.0.1:57025/devtools/page/E92631E25C560C9429E1E69B4F5774EE",
    );
  });

  test("carries the screencast choice in the address", () => {
    const base =
      "http://127.0.0.1:19222/devtools/inspector.html?ws=127.0.0.1:19222/devtools/page/A";
    expect(withScreencast(base, false)).toBe(`${base}&capubridgeScreencast=hide`);
    expect(withScreencast(base, true)).toBe(`${base}&capubridgeScreencast=show`);
  });

  test("refuses anything that is not a loopback page socket", () => {
    expect(inspectorUrlFor("ws://192.168.1.20:9222/devtools/page/ABC")).toBeNull();
    expect(inspectorUrlFor("ws://127.0.0.1:9222/devtools/browser/ABC")).toBeNull();
    expect(inspectorUrlFor("wss://127.0.0.1:9222/devtools/page/ABC")).toBeNull();
    expect(inspectorUrlFor("ws://127.0.0.1/devtools/page/ABC")).toBeNull();
    expect(inspectorUrlFor("ws://127.0.0.1:9222/devtools/page/A?x=<script>")).toBeNull();
    expect(inspectorUrlFor("not a url")).toBeNull();
  });
});
