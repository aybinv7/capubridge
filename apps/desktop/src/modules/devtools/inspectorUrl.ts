const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The address of the DevTools that the page's own browser serves for it: WebView2 bundles the
 * DevTools frontend in its debug server, so it matches the engine and needs no network. Only a
 * loopback page socket qualifies; anything else gets no DevTools.
 */
export function inspectorUrlFor(webSocketDebuggerUrl: string): string | null {
  let socket: URL;
  try {
    socket = new URL(webSocketDebuggerUrl);
  } catch {
    return null;
  }
  if (socket.protocol !== "ws:" || !LOOPBACK.has(socket.hostname) || !socket.port) return null;
  if (!/^\/devtools\/page\/[\w-]+$/.test(socket.pathname)) return null;
  if (socket.search || socket.hash || socket.username || socket.password) return null;
  const host = `${socket.hostname}:${socket.port}`;
  return `http://${host}/devtools/inspector.html?ws=${host}${socket.pathname}`;
}
