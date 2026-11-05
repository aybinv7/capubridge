import { describe, expect, it } from "vite-plus/test";
import { isCapubridgeOrigin } from "../preview-origin";

describe("isCapubridgeOrigin", () => {
  const own = "http://localhost:5173";

  it("matches the app's own origin whatever the path or hash", () => {
    expect(isCapubridgeOrigin("http://localhost:5173/#/devices/overview", own)).toBe(true);
    expect(isCapubridgeOrigin("http://localhost:5173", own)).toBe(true);
  });

  it("lets other ports, hosts and invalid input through", () => {
    expect(isCapubridgeOrigin("http://localhost:5174/", own)).toBe(false);
    expect(isCapubridgeOrigin("https://localhost:5173/", own)).toBe(false);
    expect(isCapubridgeOrigin("not a url", own)).toBe(false);
  });
});
