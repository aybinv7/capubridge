import { describe, expect, test } from "vite-plus/test";
import { decodeText, splitLines } from "@/shared/code-viewer/textLines";
import { noPreviewTitle, readErrorSentence, tooLargeDetail, viewerKeyAction } from "../viewerCopy";

const MB = 1024 * 1024;

function key(
  key: string,
  modifiers: Partial<Record<"ctrl" | "meta" | "alt" | "shift", true>> = {},
) {
  return {
    key,
    ctrlKey: modifiers.ctrl ?? false,
    metaKey: modifiers.meta ?? false,
    altKey: modifiers.alt ?? false,
    shiftKey: modifiers.shift ?? false,
  };
}

describe("viewerCopy", () => {
  test("explains read errors in plain words", () => {
    expect(readErrorSentence("File not found or is a directory")).toBe(
      "The file is no longer on the phone, or it is a folder.",
    );
    expect(
      readErrorSentence("NotFoundError: A requested file or directory could not be found"),
    ).toBe("The file is no longer on the phone, or it is a folder.");
    expect(readErrorSentence("Shell command failed: closed")).toBe(
      "The file could not be read from the phone.",
    );
  });

  test("says why a file was not read", () => {
    expect(tooLargeDetail("video", 200 * MB, 340 * MB)).toBe(
      "Videos up to 200 MB open here. This one is 340 MB.",
    );
    expect(tooLargeDetail("image", 20 * MB, null)).toBe(
      "Pictures up to 20 MB open here. This one is larger.",
    );
  });

  test("keeps the old dialog's title", () => {
    expect(noPreviewTitle("base.apk", "apk")).toBe("No preview for .apk files");
    expect(noPreviewTitle("blob", "")).toBe("No preview for this file");
  });
});

describe("viewerKeyAction", () => {
  test("steps with bare arrows unless focus owns them", () => {
    expect(viewerKeyAction(key("ArrowLeft"), false)).toBe("prev");
    expect(viewerKeyAction(key("ArrowRight"), false)).toBe("next");
    expect(viewerKeyAction(key("ArrowRight"), true)).toBeNull();
    expect(viewerKeyAction(key("ArrowRight", { shift: true }), false)).toBeNull();
  });

  test("opens find with Ctrl or Cmd F, even from a field", () => {
    expect(viewerKeyAction(key("f", { ctrl: true }), true)).toBe("find");
    expect(viewerKeyAction(key("F", { meta: true }), false)).toBe("find");
    expect(viewerKeyAction(key("f"), false)).toBeNull();
  });
});

describe("textLines", () => {
  test("drops a byte-order mark and a character cut by the read", () => {
    const encoded = new TextEncoder().encode("﻿café");
    expect(decodeText(encoded, false)).toBe("café");
    expect(decodeText(encoded.subarray(0, encoded.length - 1), true)).toBe("caf");
  });

  test("splits on any line ending without a phantom last line", () => {
    expect(splitLines("a\r\nb\nc\n")).toEqual(["a", "b", "c"]);
    expect(splitLines("")).toEqual([""]);
    expect(splitLines("\n")).toEqual([""]);
  });
});
