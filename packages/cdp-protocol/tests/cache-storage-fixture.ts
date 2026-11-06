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
  /**
   * Match like the browser does for `keys(request)`, `match` and `delete`: same method and
   * address, and only the request headers the stored response names in `Vary` must agree.
   */
  varyAware = false;
  /** Addresses whose `match` throws, like a response the browser cannot read back. */
  readonly broken = new Set<string>();

  private matches(stored: { request: Request; response: Response }, request: Request): boolean {
    if (stored.request.url !== request.url || stored.request.method !== request.method)
      return false;
    const vary = (stored.response.headers.get("vary") ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
    return vary.every((name) => stored.request.headers.get(name) === request.headers.get(name));
  }

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

  async keys(request?: Request, options: { ignoreVary?: boolean } = {}): Promise<Request[]> {
    if (!request) return this.items.map((item) => item.request);
    if (options.ignoreVary) {
      return this.items
        .filter(
          (item) => item.request.url === request.url && item.request.method === request.method,
        )
        .map((item) => item.request);
    }
    if (!this.varyAware) {
      const index = this.indexOf(request);
      return index < 0 ? [] : [this.items[index]?.request as Request];
    }
    return this.items.filter((item) => this.matches(item, request)).map((item) => item.request);
  }

  async match(request: Request): Promise<Response | undefined> {
    if (this.broken.has(request.url)) throw new Error("The response could not be read");
    const item = this.varyAware
      ? this.items.find((entry) => this.matches(entry, request))
      : this.items[this.indexOf(request)];
    return item?.response.clone();
  }

  async delete(request: Request): Promise<boolean> {
    if (this.varyAware) {
      const before = this.items.length;
      this.items = this.items.filter((item) => !this.matches(item, request));
      return this.items.length < before;
    }
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
