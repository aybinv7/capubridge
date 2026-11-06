function domError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** A file of the fake OPFS; `locked` makes it behave as one the app holds open. */
export class FakeOpfsFile {
  readonly kind = "file";
  locked = false;

  constructor(
    public bytes: Uint8Array,
    public lastModified = 1_700_000_000_000,
  ) {}

  async getFile() {
    if (this.locked) {
      throw domError("NoModificationAllowedError", "Access handles cannot be created");
    }
    const bytes = this.bytes;
    return {
      size: bytes.length,
      lastModified: this.lastModified,
      slice: (start = 0, end = bytes.length) => ({
        arrayBuffer: async () => bytes.slice(start, end).buffer,
      }),
    };
  }

  /** What the app does when it writes the file. */
  write(bytes: Uint8Array) {
    this.bytes = bytes;
    this.lastModified += 1000;
  }
}

/** A folder of the fake OPFS, with the `FileSystemDirectoryHandle` calls the scripts use. */
export class FakeOpfsFolder {
  readonly kind = "directory";
  readonly children = new Map<string, FakeOpfsFolder | FakeOpfsFile>();

  folder(name: string): FakeOpfsFolder {
    const existing = this.children.get(name);
    if (existing instanceof FakeOpfsFolder) return existing;
    const created = new FakeOpfsFolder();
    this.children.set(name, created);
    return created;
  }

  file(name: string, text = "", lastModified?: number): FakeOpfsFile {
    const created = new FakeOpfsFile(new TextEncoder().encode(text), lastModified);
    this.children.set(name, created);
    return created;
  }

  async *entries(): AsyncGenerator<[string, FakeOpfsFolder | FakeOpfsFile]> {
    for (const pair of this.children) yield pair;
  }

  async getDirectoryHandle(name: string): Promise<FakeOpfsFolder> {
    const child = this.children.get(name);
    if (!child) throw domError("NotFoundError", "A requested file or directory could not be found");
    if (!(child instanceof FakeOpfsFolder)) {
      throw domError("TypeMismatchError", "The path supplied exists, but was not a directory");
    }
    return child;
  }

  async getFileHandle(name: string): Promise<FakeOpfsFile> {
    const child = this.children.get(name);
    if (!child) throw domError("NotFoundError", "A requested file or directory could not be found");
    if (!(child instanceof FakeOpfsFile)) {
      throw domError("TypeMismatchError", "The path supplied exists, but was not a file");
    }
    return child;
  }

  async removeEntry(name: string, options: { recursive?: boolean } = {}): Promise<void> {
    const child = this.children.get(name);
    if (!child) throw domError("NotFoundError", "A requested file or directory could not be found");
    if (child instanceof FakeOpfsFile && child.locked) {
      throw domError("NoModificationAllowedError", "The file is locked");
    }
    if (child instanceof FakeOpfsFolder && child.children.size > 0 && !options.recursive) {
      throw domError("InvalidModificationError", "The directory is not empty");
    }
    if (child instanceof FakeOpfsFolder) child.clearUntilLocked();
    this.children.delete(name);
  }

  /** What a recursive delete does: removes entries one by one and stops at a held-open file. */
  private clearUntilLocked(): void {
    for (const [name, child] of this.children) {
      if (child instanceof FakeOpfsFolder) child.clearUntilLocked();
      else if (child.locked) throw domError("NoModificationAllowedError", "The file is locked");
      this.children.delete(name);
    }
  }

  has(path: string): boolean {
    const [first, ...rest] = path.split("/").filter(Boolean);
    if (first === undefined) return true;
    const child = this.children.get(first);
    if (!child) return false;
    if (rest.length === 0) return true;
    return child instanceof FakeOpfsFolder && child.has(rest.join("/"));
  }
}

/** Puts `root` behind `navigator.storage.getDirectory()`, or removes OPFS like an insecure page. */
export function installOpfs(root: FakeOpfsFolder | undefined): void {
  Object.defineProperty(globalThis, "navigator", {
    value: root ? { storage: { getDirectory: async () => root } } : {},
    configurable: true,
    writable: true,
  });
}
