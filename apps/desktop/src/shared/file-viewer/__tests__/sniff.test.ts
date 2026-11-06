import { describe, expect, test } from "vite-plus/test";
import { looksLikeText, sniffBytes, sniffedImageMime } from "../sniff";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("sniffBytes", () => {
  test("recognises image signatures", () => {
    expect(sniffBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("png");
    expect(sniffBytes(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("jpeg");
    expect(sniffBytes(ascii("GIF89a....."))).toBe("gif");
    expect(sniffBytes(ascii("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("webp");
  });

  test("recognises SQLite and PDF headers", () => {
    expect(sniffBytes(ascii("SQLite format 3\u0000rest of header"))).toBe("sqlite");
    expect(sniffBytes(ascii("%PDF-1.7\n%âãÏÓ"))).toBe("pdf");
  });

  test("tells text from binary", () => {
    expect(sniffBytes(ascii('{"ok": true}\n'))).toBe("text");
    expect(sniffBytes(ascii("héllo wörld — ünïcode"))).toBe("text");
    expect(sniffBytes(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00))).toBe("binary");
    expect(sniffBytes(bytes())).toBe("text");
  });

  test("allows a UTF-8 character cut by the sample end", () => {
    const encoded = ascii("ok é");
    expect(looksLikeText(encoded.subarray(0, encoded.length - 1))).toBe(true);
  });

  test("rejects invalid UTF-8 and control-heavy samples", () => {
    expect(looksLikeText(bytes(0x61, 0xc3, 0x28, 0x62))).toBe(false);
    expect(looksLikeText(bytes(1, 2, 3, 4, 5, 6, 0x61, 0x62))).toBe(false);
  });

  test("maps sniffed images to MIME types", () => {
    expect(sniffedImageMime("webp")).toBe("image/webp");
    expect(sniffedImageMime("sqlite")).toBeNull();
  });
});
