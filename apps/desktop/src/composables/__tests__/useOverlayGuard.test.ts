// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vite-plus/test";
import { hasBlockingOverlay } from "../useOverlayGuard";

function portal(html: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe("hasBlockingOverlay", () => {
  afterEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  test("ignores the application root even when it contains dialogs", () => {
    document.body.innerHTML = '<div id="app"><div role="dialog"></div></div>';
    expect(hasBlockingOverlay(document.body)).toBe(false);
  });

  test("detects a portalled dialog", () => {
    portal('<div role="dialog" data-state="open"></div>');
    expect(hasBlockingOverlay(document.body)).toBe(true);
  });

  test("detects menus, listboxes and popper content", () => {
    portal('<div role="menu"></div>');
    expect(hasBlockingOverlay(document.body)).toBe(true);
    document.body.innerHTML = "";
    portal('<div role="listbox"></div>');
    expect(hasBlockingOverlay(document.body)).toBe(true);
    document.body.innerHTML = "";
    portal("<div data-reka-popper-content-wrapper><div>popover</div></div>");
    expect(hasBlockingOverlay(document.body)).toBe(true);
  });

  test("detects hand-built overlays marked with data-overlay", () => {
    portal("<div data-overlay></div>");
    expect(hasBlockingOverlay(document.body)).toBe(true);
  });

  test("does not treat tooltips as blocking", () => {
    portal('<div data-reka-popper-content-wrapper><div role="tooltip">hint</div></div>');
    expect(hasBlockingOverlay(document.body)).toBe(false);
  });

  test("returns false once the overlay is removed", () => {
    const host = portal('<div role="dialog"></div>');
    host.remove();
    expect(hasBlockingOverlay(document.body)).toBe(false);
  });
});
