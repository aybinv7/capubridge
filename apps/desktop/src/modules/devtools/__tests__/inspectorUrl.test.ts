import { describe, expect, test } from "vite-plus/test";
import { devtoolsUrlFor, phoneDevtoolsUrl } from "../inspectorUrl";

const SOCKET = "ws://127.0.0.1:19222/devtools/page/E92631E25C560C9429E1E69B4F5774EE";
const SOCKET_PARAM = encodeURIComponent(
  "127.0.0.1:19222/devtools/page/E92631E25C560C9429E1E69B4F5774EE",
);

describe("devtoolsUrlFor", () => {
  test("opens DevTools alone, with no copy of the page, unless asked", () => {
    expect(devtoolsUrlFor(SOCKET, false)).toBe(
      `http://127.0.0.1:19222/devtools/devtools_app.html?ws=${SOCKET_PARAM}&capubridgeScreencast=hide`,
    );
  });

  test("opens the remote DevTools, which draws the copy, when asked", () => {
    expect(devtoolsUrlFor(SOCKET, true)).toBe(
      `http://127.0.0.1:19222/devtools/inspector.html?ws=${SOCKET_PARAM}&capubridgeScreencast=show`,
    );
  });

  test("the frontend reads the socket back whole", () => {
    const url = new URL(devtoolsUrlFor(SOCKET, false) ?? "");
    expect(url.searchParams.get("ws")).toBe(
      "127.0.0.1:19222/devtools/page/E92631E25C560C9429E1E69B4F5774EE",
    );
  });

  test("refuses anything that is not a loopback page socket", () => {
    for (const socket of [
      "ws://192.168.1.20:9222/devtools/page/ABC",
      "ws://127.0.0.1:9222/devtools/browser/ABC",
      "wss://127.0.0.1:9222/devtools/page/ABC",
      "ws://127.0.0.1/devtools/page/ABC",
      "ws://127.0.0.1:9222/devtools/page/A?x=<script>",
      "not a url",
    ]) {
      expect(devtoolsUrlFor(socket, false)).toBeNull();
    }
  });
});

describe("phoneDevtoolsUrl", () => {
  test("serves the frontend locally and connects it through the proxy", () => {
    const url = new URL(
      phoneDevtoolsUrl(19222, "ws://127.0.0.1:53110/?token=abc_DEF-123", false) ?? "",
    );
    expect(url.origin).toBe("http://127.0.0.1:19222");
    expect(url.pathname).toBe("/devtools/devtools_app.html");
    expect(url.searchParams.get("ws")).toBe("127.0.0.1:53110/?token=abc_DEF-123");
    expect(url.searchParams.get("capubridgeScreencast")).toBe("hide");
  });

  test("accepts only Capubridge's own proxy socket", () => {
    for (const proxy of [
      "ws://10.0.0.5:53110/?token=abc",
      "ws://127.0.0.1:53110/devtools/page/X",
      "ws://127.0.0.1:53110/?token=abc&x=1",
      "ws://127.0.0.1:53110/?other=abc",
      "wss://127.0.0.1:53110/?token=abc",
    ]) {
      expect(phoneDevtoolsUrl(19222, proxy, false)).toBeNull();
    }
    expect(phoneDevtoolsUrl(0, "ws://127.0.0.1:53110/?token=abc", false)).toBeNull();
  });
});
