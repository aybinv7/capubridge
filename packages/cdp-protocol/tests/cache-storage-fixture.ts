function headerText(headers: Headers): string {
  return [...headers]
    .map(([name, value]) => `${name.toLowerCase()}:${value}`)
    .sort()
    .join("\n");
}

/** A response the browser hides from the page (a `no-cors` fetch). */
export function opaqueResponse(): Response {
  return {
    type: "opaque",
    status: 0,
    statusText: "",
    redirected: false,
    url: "",
    headers: new Headers(),
    clone() {
      return this;
    },
    async blob() {
      return new Blob([]);
    },
  } as unknown as Response;
}

/**
 * One cache: entries match on method, address and the stored request headers, so two Vary
 * variants of one address are two entries. Every match hands out a clone, like the browser.
 */
export class FakeCache {
  private items: { request: Request; response: Response }[] = [];

  private indexOf(request: Request): number {
    return this.items.findIndex(
      (item) =>
        item.request.url === request.url &&
        item.request.method === request.method &&
        headerText(item.request.headers) === headerText(request.headers),
    );
  }

  put(request: Request, response: Response): void {
    const index = this.indexOf(request);
    if (index >= 0) this.items[index] = { request, response };
    else this.items.push({ request, response });
  }

  async keys(): Promise<Request[]> {
    return this.items.map((item) => item.request);
  }

  async match(request: Request): Promise<Response | undefined> {
    const item = this.items[this.indexOf(request)];
    return item?.response.clone();
  }

  async delete(request: Request): Promise<boolean> {
    const index = this.indexOf(request);
    if (index < 0) return false;
    this.items.splice(index, 1);
    return true;
  }

  get urls(): string[] {
    return this.items.map((item) => `${item.request.url} ${headerText(item.request.headers)}`);
  }
}

/** `caches` of a page; `opened` records every `open`, so a test can tell nothing was created. */
export class FakeCacheStorage {
  readonly map = new Map<string, FakeCache>();
  readonly opened: string[] = [];

  add(name: string): FakeCache {
    const cache = new FakeCache();
    this.map.set(name, cache);
    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }

  async has(name: string): Promise<boolean> {
    return this.map.has(name);
  }

  async open(name: string): Promise<FakeCache> {
    this.opened.push(name);
    const cache = this.map.get(name) ?? this.add(name);
    return cache;
  }

  async delete(name: string): Promise<boolean> {
    return this.map.delete(name);
  }
}

/** Puts `storage` in place of the page's `caches` (or removes it, like an insecure page). */
export function installCaches(storage: FakeCacheStorage | undefined): void {
  Object.defineProperty(globalThis, "caches", {
    value: storage,
    configurable: true,
    writable: true,
  });
}
