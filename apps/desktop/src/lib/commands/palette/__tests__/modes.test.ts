import { describe, expect, test } from "vite-plus/test";
import { applyInput, leaveMode, parsePaletteInput } from "../modes";

describe("parsePaletteInput", () => {
  test("plain text is a search", () => {
    expect(parsePaletteInput("sqlite")).toEqual({ mode: "all", text: "sqlite" });
    expect(parsePaletteInput("")).toEqual({ mode: "all", text: "" });
  });

  test("each prefix enters its mode and drops the sign", () => {
    expect(parsePaletteInput(">")).toEqual({ mode: "actions", text: "" });
    expect(parsePaletteInput(">  force")).toEqual({ mode: "actions", text: "force" });
    expect(parsePaletteInput("@pixel")).toEqual({ mode: "device", text: "pixel" });
    expect(parsePaletteInput("#users")).toEqual({ mode: "table", text: "users" });
    expect(parsePaletteInput(":")).toEqual({ mode: "screen", text: "" });
  });

  test("open followed by a space enters the app list, with or without >", () => {
    expect(parsePaletteInput("open ")).toEqual({ mode: "open", text: "" });
    expect(parsePaletteInput("open presalio")).toEqual({ mode: "open", text: "presalio" });
    expect(parsePaletteInput(">open ret")).toEqual({ mode: "open", text: "ret" });
    expect(parsePaletteInput("> Open  ret")).toEqual({ mode: "open", text: "ret" });
  });

  test("open without a following space stays a search", () => {
    expect(parsePaletteInput("open")).toEqual({ mode: "all", text: "open" });
    expect(parsePaletteInput("opened")).toEqual({ mode: "all", text: "opened" });
    expect(parsePaletteInput(">open")).toEqual({ mode: "actions", text: "open" });
  });
});

describe("applyInput", () => {
  test("a prefix typed in the plain mode switches mode", () => {
    expect(applyInput({ mode: "all", text: "" }, "@")).toEqual({ mode: "device", text: "" });
  });

  test("inside a mode the input is plain text, signs included", () => {
    expect(applyInput({ mode: "device", text: "" }, "#x")).toEqual({ mode: "device", text: "#x" });
    expect(applyInput({ mode: "open", text: "a" }, "open b")).toEqual({
      mode: "open",
      text: "open b",
    });
  });

  test("open typed after > moves to the app list", () => {
    expect(applyInput({ mode: "actions", text: "" }, "open ")).toEqual({
      mode: "open",
      text: "",
    });
    expect(applyInput({ mode: "actions", text: "" }, "restart")).toEqual({
      mode: "actions",
      text: "restart",
    });
  });
});

describe("leaveMode", () => {
  test("Backspace on an empty input leaves the mode", () => {
    expect(leaveMode({ mode: "open", text: "" })).toEqual({ mode: "all", text: "" });
  });

  test("keeps the mode while there is text or no mode", () => {
    const withText = { mode: "open" as const, text: "a" };
    expect(leaveMode(withText)).toBe(withText);
    const plain = { mode: "all" as const, text: "" };
    expect(leaveMode(plain)).toBe(plain);
  });
});
