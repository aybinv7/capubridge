import { describe, expect, test } from "vite-plus/test";
import { EMPTY_THIS_PC, isSavedThisPc, savedSelection } from "../this-pc-session";

describe("saved This PC tabs", () => {
  test("accepts saved tabs with an open one", () => {
    const saved = {
      urls: ["http://localhost:5181/panels/planograms", "https://app.example.com/"],
      selected: 1,
      active: true,
    };
    expect(isSavedThisPc(saved)).toBe(true);
    expect(savedSelection(saved)).toBe("https://app.example.com/");
    expect(isSavedThisPc(EMPTY_THIS_PC)).toBe(true);
  });

  test("ignores anything that is not a network page", () => {
    expect(isSavedThisPc({ urls: ["javascript:alert(1)"], selected: null, active: false })).toBe(
      false,
    );
    expect(isSavedThisPc({ urls: ["file:///C:/x.html"], selected: null, active: false })).toBe(
      false,
    );
    expect(isSavedThisPc({ urls: "http://x", selected: null, active: false })).toBe(false);
  });

  test("an index past the saved tabs opens none", () => {
    expect(savedSelection({ urls: ["http://localhost:1/"], selected: 4, active: true })).toBeNull();
    expect(
      savedSelection({ urls: ["http://localhost:1/"], selected: null, active: true }),
    ).toBeNull();
  });
});
