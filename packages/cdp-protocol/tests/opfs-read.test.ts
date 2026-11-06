import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { OPFSDomain, OPFS_READ_CHUNK_BYTES } from "../src/cdp/domains/opfs.ts";
import { PAGE, fakeOrigin, pageClient } from "./keyvalue-fixture.ts";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

class FakeFileReader {
  result: string | null = null;
  error: Error | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString("base64")}`;
      this.onload?.();
    });
  }
}

function installFile(bytes: Uint8Array<ArrayBuffer>) {
  const file = new File([bytes], "app.sqlite3");
  const root = {
    getFileHandle: async () => ({ getFile: async () => file }),
    getDirectoryHandle: async () => root,
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { storage: { getDirectory: async () => root } },
    configurable: true,
    writable: true,
  });
}

beforeAll(() => {
  Object.defineProperty(globalThis, "FileReader", {
    value: FakeFileReader,
    configurable: true,
    writable: true,
  });
});

afterAll(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  Reflect.deleteProperty(globalThis, "FileReader");
});

describe("OPFS file reads (F3)", () => {
  test("a large file comes in small chunks, byte for byte", async () => {
    const bytes = new Uint8Array(OPFS_READ_CHUNK_BYTES * 2 + 123).map((_, index) => index % 251);
    installFile(bytes);
    const progress: number[] = [];
    const read = await new OPFSDomain(pageClient({ [PAGE]: fakeOrigin() })).readFileBytes(
      "app.sqlite3",
      { onProgress: (loaded) => progress.push(loaded) },
    );
    expect(read.length).toBe(bytes.length);
    expect(Buffer.compare(Buffer.from(read), Buffer.from(bytes))).toBe(0);
    expect(progress).toHaveLength(3);
  });

  test("a cancelled read stops between chunks", async () => {
    installFile(new Uint8Array(OPFS_READ_CHUNK_BYTES * 3));
    const controller = new AbortController();
    const domain = new OPFSDomain(pageClient({ [PAGE]: fakeOrigin() }));
    const reading = domain.readFileBytes("app.sqlite3", {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    await expect(reading).rejects.toMatchObject({ name: "AbortError" });
  });
});
