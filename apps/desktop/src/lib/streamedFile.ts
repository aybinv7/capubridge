import { invokeCommand, invokeCommandBytes } from "@/runtime/ipc/client";

const FLUSH_AT = 4 * 1024 * 1024;

/** A file on this computer written piece by piece; it replaces the destination only on `finish`. */
export interface StreamedFile {
  write(text: string): Promise<void>;
  /** Text handed to the file so far, in characters (equal to bytes for ASCII JSON). */
  readonly bytes: number;
  finish(): Promise<number>;
  discard(): Promise<void>;
}

/**
 * Opens `path` for a streamed write. Text is buffered and sent as raw UTF-8 bytes in pieces of
 * about 4 MiB, so the webview never holds the whole file.
 */
export async function openStreamedFile(path: string): Promise<StreamedFile> {
  const id = await invokeCommand("host_file_stream_begin", { path });
  const encoder = new TextEncoder();
  let pending: string[] = [];
  let pendingLength = 0;
  let bytes = 0;
  let closed = false;

  async function flush() {
    if (pendingLength === 0) return;
    const chunk = encoder.encode(pending.join(""));
    pending = [];
    pendingLength = 0;
    await invokeCommandBytes("host_file_stream_append", chunk, {
      "x-capubridge-stream": String(id),
    });
  }

  return {
    get bytes() {
      return bytes;
    },
    async write(text: string) {
      if (closed) throw new Error("The file is already closed");
      pending.push(text);
      pendingLength += text.length;
      bytes += text.length;
      if (pendingLength >= FLUSH_AT) await flush();
    },
    async finish() {
      if (closed) throw new Error("The file is already closed");
      await flush();
      closed = true;
      return invokeCommand("host_file_stream_finish", { id });
    },
    async discard() {
      if (closed) return;
      closed = true;
      pending = [];
      await invokeCommand("host_file_stream_discard", { id });
    },
  };
}
