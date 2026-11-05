import { describe, expect, test } from "vite-plus/test";
import { loadViewerContent } from "../loadContent";
import { READ_CAPS } from "../readPlan";
import type { FileBytes, ReadBytes } from "../viewerContent";

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function file(data: Uint8Array | string) {
  const bytes: FileBytes =
    typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const requests: number[] = [];
  const read: ReadBytes = (maxBytes) => {
    requests.push(maxBytes);
    return Promise.resolve(bytes.slice(0, maxBytes));
  };
  return { bytes, requests, read };
}

function filled(length: number, head: readonly number[] = [], fill = 0x00): Uint8Array {
  const out = new Uint8Array(length).fill(fill);
  out.set(head);
  return out;
}

describe("loadViewerContent", () => {
  test("refuses oversized media before reading a byte", async () => {
    const { read, requests } = file("");
    const outcome = await loadViewerContent("clip.mp4", 300 * 1024 * 1024, read);
    expect(outcome).toEqual({
      status: "too-large",
      kind: "video",
      cap: READ_CAPS.media,
      size: 300 * 1024 * 1024,
    });
    expect(requests).toEqual([]);
  });

  test("turns an image into a typed Blob and keeps its first bytes", async () => {
    const { read } = file(filled(4000, PNG_HEAD));
    const outcome = await loadViewerContent("shot.png", 4000, read);
    expect(outcome.status).toBe("ready");
    if (outcome.status !== "ready" || outcome.content.kind !== "image") throw new Error("image");
    expect(outcome.content.blob.type).toBe("image/png");
    expect(outcome.content.blob.size).toBe(4000);
    expect(outcome.content.head.length).toBe(READ_CAPS.probe);
  });

  test("cuts long text at 2 MB and says so", async () => {
    const { read } = file("a\n".repeat(READ_CAPS.text));
    const outcome = await loadViewerContent("app.log", 2 * READ_CAPS.text, read);
    if (outcome.status !== "ready" || outcome.content.kind !== "text") throw new Error("text");
    expect(outcome.content.language).toBe("log");
    expect(outcome.content.text.length).toBe(READ_CAPS.text);
    expect(outcome.content.truncation).toEqual({
      shown: READ_CAPS.text,
      total: 2 * READ_CAPS.text,
    });
  });

  test("parses whole JSON and pretty-prints it", async () => {
    const { read } = file('{"a":[1,2]}');
    const outcome = await loadViewerContent("state.json", 11, read);
    if (outcome.status !== "ready" || outcome.content.kind !== "json") throw new Error("json");
    expect(outcome.content.parse).toEqual({ ok: true, value: { a: [1, 2] } });
    expect(outcome.content.pretty).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
  });

  test("keeps invalid JSON as text with the parser's message", async () => {
    const { read } = file("{oops");
    const outcome = await loadViewerContent("bad.json", 5, read);
    if (outcome.status !== "ready" || outcome.content.kind !== "json") throw new Error("json");
    expect(outcome.content.parse?.ok).toBe(false);
    expect(outcome.content.pretty).toBe("{oops");
  });

  test("does not parse a cut JSON file", async () => {
    const { read } = file(`[${"1,".repeat(READ_CAPS.text)}1]`);
    const outcome = await loadViewerContent("big.json", 0, read);
    if (outcome.status !== "ready" || outcome.content.kind !== "json") throw new Error("json");
    expect(outcome.content.parse).toBeNull();
    expect(outcome.content.truncation?.total).toBeNull();
  });

  test("reads the SQLite header from the probe alone", async () => {
    const header = filled(4096, [...new TextEncoder().encode("SQLite format 3\0"), 0x10, 0x00]);
    const { read, requests } = file(header);
    const outcome = await loadViewerContent("app.db", 4096, read);
    if (outcome.status !== "ready" || outcome.content.kind !== "sqlite") throw new Error("sqlite");
    expect(outcome.content.header?.pageSize).toBe(4096);
    expect(requests).toEqual([READ_CAPS.probe]);
  });

  test("shows a .db file that is not SQLite as bytes", async () => {
    const { read } = file(filled(64, [1, 2, 3]));
    const outcome = await loadViewerContent("cache.db", 64, read);
    expect(outcome.status === "ready" && outcome.content.kind).toBe("binary");
  });

  test("upgrades an extensionless picture with a second, larger read", async () => {
    const { read, requests } = file(filled(5000, PNG_HEAD));
    const outcome = await loadViewerContent("thumbnail", 5000, read);
    if (outcome.status !== "ready" || outcome.content.kind !== "image") throw new Error("image");
    expect(outcome.content.blob.type).toBe("image/png");
    expect(requests).toEqual([READ_CAPS.probe, 5000]);
  });

  test("shows small extensionless text without reading twice", async () => {
    const { read, requests } = file("key=value\n");
    const outcome = await loadViewerContent("prefs", 10, read);
    if (outcome.status !== "ready" || outcome.content.kind !== "text") throw new Error("text");
    expect(outcome.content.text).toBe("key=value\n");
    expect(requests).toEqual([10]);
  });

  test("shows a PDF as its first kilobyte of bytes", async () => {
    const { read } = file(filled(9000, [...new TextEncoder().encode("%PDF-1.7")], 0x20));
    const outcome = await loadViewerContent("report.pdf", 9000, read);
    if (outcome.status !== "ready" || outcome.content.kind !== "binary") throw new Error("binary");
    expect(outcome.content.head.length).toBe(READ_CAPS.probe);
    expect(outcome.content.truncation).toEqual({ shown: READ_CAPS.probe, total: 9000 });
  });

  test("falls back to bytes when a text file holds binary data", async () => {
    const { read } = file(filled(100, [0x61, 0x00, 0x62]));
    const outcome = await loadViewerContent("weird.txt", 100, read);
    expect(outcome.status === "ready" && outcome.content.kind).toBe("binary");
  });
});
