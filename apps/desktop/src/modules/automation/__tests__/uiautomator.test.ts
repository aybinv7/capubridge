import { describe, expect, test } from "vite-plus/test";
import { parseUiAutomatorDump } from "../uiautomator";

const DUMP = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.example.app" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][1080,2400]">
    <node index="1" text="Sign in" resource-id="com.example.app:id/login" class="android.widget.Button" package="com.example.app" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[100,200][400,300]" />
    <node index="2" text="" resource-id="" class="android.inputmethodservice.SoftInputWindow" package="com.android.inputmethod.latin" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,1500][1080,2400]" />
  </node>
</hierarchy>`;

const WEBVIEW_DUMP = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.example.app" bounds="[0,80][1080,2280]">
    <node index="1" text="" resource-id="" class="android.webkit.WebView" package="com.example.app" bounds="[0,140][1080,2100]" />
  </node>
</hierarchy>`;

describe("parseUiAutomatorDump", () => {
  test("parses controls with bounds, flags and labels", () => {
    const snapshot = parseUiAutomatorDump(DUMP);
    expect(snapshot.controls).toHaveLength(3);
    const button = snapshot.controls.find((control) => control.text === "Sign in");
    expect(button).toMatchObject({
      className: "android.widget.Button",
      bounds: [100, 200, 300, 100],
      clickable: true,
      enabled: true,
    });
    expect(snapshot.packageName).toBe("com.example.app");
  });

  test("nests the hierarchy for system-ui derivation", () => {
    const snapshot = parseUiAutomatorDump(DUMP);
    expect(snapshot.hierarchy).toHaveLength(1);
    expect(snapshot.hierarchy[0]?.children).toHaveLength(2);
    expect(snapshot.hierarchy[0]?.children?.[1]?.className).toContain("SoftInputWindow");
  });

  test("captures the host rectangle for WebView coordinate grounding", () => {
    const snapshot = parseUiAutomatorDump(WEBVIEW_DUMP);
    expect(snapshot.webViewBounds).toEqual([0, 140, 1080, 1960]);
  });

  test("tolerates tool chatter before the payload", () => {
    const snapshot = parseUiAutomatorDump(`UI hierchary dumped to: /dev/stdout\n${DUMP}`);
    expect(snapshot.controls).toHaveLength(3);
  });

  test("rejects output without an XML payload", () => {
    expect(() => parseUiAutomatorDump("daemon not running")).toThrow(/no XML payload/);
    expect(() => parseUiAutomatorDump("<html></html>")).toThrow();
  });
});
