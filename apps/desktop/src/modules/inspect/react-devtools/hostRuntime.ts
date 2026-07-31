/**
 * Host-side runtime for the React DevTools panel.
 *
 * `react-devtools-core/dist/standalone.js` is the official DevTools UI, but it
 * is built for a Node/Electron renderer: it is CommonJS, reads `process`, and
 * has `const CS = require("child_process")` at module scope. The Node-ish
 * modules it genuinely uses (`net`, `http`, `https`) are lazy webpack externals
 * reached only from `startServer`, which we never call — we use
 * `connectToSocket` instead. So a small shim is enough to load it in an iframe.
 */

export const HOST_READY_FLAG = "__capubridgeReactDevtoolsHostReady";

/**
 * Satisfies the CommonJS/Node surface the bundle touches at load time. Nothing
 * here needs to work, only exist: the code paths that would use it belong to
 * `startServer` and the profiler's editor launcher.
 */
export function buildCommonJsShimSource() {
  return `(() => {
  const w = window;
  w.global = w;
  w.process = w.process || {
    env: { NODE_ENV: "production" },
    platform: "browser",
    argv: [],
    version: "v20.0.0",
    versions: {},
    nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0),
    cwd: () => "/",
    on: () => {},
    stdout: { write: () => {} },
    stderr: { write: () => {} },
  };

  // ws is bundled and evaluates at load: constants.js -> buffer-util.js ->
  // permessage-deflate.js all run before anything we call, and they need Buffer.
  if (typeof w.Buffer === "undefined") {
    const B = class extends Uint8Array {
      static alloc(size) { return new B(size); }
      static allocUnsafe(size) { return new B(size); }
      static isBuffer(value) { return value instanceof B || value instanceof Uint8Array; }
      static from(value, encoding) {
        if (typeof value === "string") {
          if (encoding === "base64") {
            const bin = atob(value);
            const out = new B(bin.length);
            for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
            return out;
          }
          return new B(new TextEncoder().encode(value));
        }
        if (value instanceof ArrayBuffer) return new B(value);
        return new B(Uint8Array.from(value || []));
      }
      static concat(list, total) {
        const parts = Array.from(list || []);
        const length = typeof total === "number" ? total : parts.reduce((n, p) => n + p.length, 0);
        const out = new B(length);
        let offset = 0;
        for (const part of parts) { out.set(part, offset); offset += part.length; }
        return out;
      }
      toString(encoding) {
        if (encoding === "base64") { let s = ""; this.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); }
        return new TextDecoder().decode(this);
      }
    };
    w.Buffer = B;
  }

  class StubEmitter {
    constructor() { this._events = {}; }
    on(name, fn) { (this._events[name] = this._events[name] || []).push(fn); return this; }
    addListener(name, fn) { return this.on(name, fn); }
    once(name, fn) { return this.on(name, fn); }
    off() { return this; }
    removeListener() { return this; }
    removeAllListeners() { return this; }
    emit(name, ...args) {
      (this._events[name] || []).forEach((fn) => fn(...args));
      return true;
    }
  }

  const notImplemented = (name) => () => {
    throw new Error("capubridge stub: " + name + " is not available in the panel");
  };

  const stubs = {
    child_process: { spawn: notImplemented("child_process.spawn"), exec: notImplemented("child_process.exec"), execSync: notImplemented("child_process.execSync") },
    fs: { existsSync: () => false, readFileSync: () => "", writeFileSync: () => {}, statSync: notImplemented("fs.statSync"), createReadStream: notImplemented("fs.createReadStream") },
    path: {
      sep: "/",
      join: (...parts) => parts.filter(Boolean).join("/"),
      resolve: (...parts) => parts.filter(Boolean).join("/"),
      dirname: (p) => String(p).split("/").slice(0, -1).join("/"),
      basename: (p) => String(p).split("/").pop(),
      extname: (p) => { const b = String(p).split("/").pop() || ""; const i = b.lastIndexOf("."); return i > 0 ? b.slice(i) : ""; },
      isAbsolute: (p) => String(p).startsWith("/"),
      relative: (_from, to) => String(to),
    },
    os: { platform: () => "browser", tmpdir: () => "/tmp", EOL: "\\n" },
    // require("events") is the EventEmitter class itself in Node, and the bundle
    // does \`class X extends require("events")\`, so this must be constructable.
    events: StubEmitter,
    stream: StubEmitter,
    net: { createServer: notImplemented("net.createServer"), Socket: StubEmitter },
    http: { createServer: notImplemented("http.createServer") },
    https: { createServer: notImplemented("https.createServer") },
    crypto: { randomBytes: (n) => ({ toString: () => "0".repeat(n * 2) }) },
    ws: { Server: notImplemented("ws.Server") },
    url: { parse: (u) => ({ href: u }) },
    util: { inspect: (v) => String(v), promisify: (fn) => fn },
    stream: { Readable: StubEmitter, Writable: StubEmitter },
    zlib: {},
    tls: {},
    assert: () => {},
  };

  StubEmitter.EventEmitter = StubEmitter;
  StubEmitter.Readable = StubEmitter;
  StubEmitter.Writable = StubEmitter;
  StubEmitter.default = StubEmitter;

  // Unknown modules fall back to a constructable stub, so \`class X extends
  // require("whatever")\` cannot blow up on a shape we failed to anticipate.
  w.require = (id) => {
    const key = String(id).replace(/^node:/, "");
    if (Object.prototype.hasOwnProperty.call(stubs, key)) return stubs[key];
    return StubEmitter;
  };
  w.module = { exports: {} };
  w.exports = w.module.exports;
})()`;
}

/**
 * The panel document. The bundle is served as a URL rather than inlined so the
 * 1.5MB payload is fetched by the iframe instead of embedded in the page.
 */
export function buildFrameHtml(standaloneScriptUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #devtools { width: 100%; height: 100%; margin: 0; overflow: hidden; }
      body { background: #0b0f14; }
    </style>
  </head>
  <body>
    <div id="devtools"></div>
    <script>${buildCommonJsShimSource()}</script>
    <script src="${standaloneScriptUrl}"></script>
    <script>
      (() => {
        // The bundle ends with \`module.exports = o\` where o is an ESM-interop
        // namespace, so the UI object sits on .default.
        const raw = window.module && window.module.exports;
        const ui = raw && typeof raw.connectToSocket === "function" ? raw : raw && raw.default;
        window.__capubridgeReactDevtoolsUI = ui;
        window.${HOST_READY_FLAG} =
          Boolean(ui) && typeof ui.connectToSocket === "function" && typeof ui.setContentDOMNode === "function";
      })();
    </script>
  </body>
</html>`;
}
