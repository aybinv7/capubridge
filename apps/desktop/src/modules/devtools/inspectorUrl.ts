const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The DevTools frontend that the local pages' browser serves from its debug server: bundled with
 * WebView2, so it needs no network. Two of its apps fit: `devtools_app.html` is DevTools alone,
 * and `inspector.html` is the remote DevTools that `chrome://inspect` opens, which always draws
 * its own copy of the page (the screencast). The copy is wanted only when asked for, so this picks
 * the app; the `capubridgeScreencast` flag also tells the DevTools view which setting to start with.
 */
function frontendUrl(server: string, socket: string, showScreencast: boolean): string {
  const app = showScreencast ? "inspector" : "devtools_app";
  const flag = showScreencast ? "show" : "hide";
  return `http://${server}/devtools/${app}.html?ws=${encodeURIComponent(socket)}&capubridgeScreencast=${flag}`;
}

function parseSocket(raw: string): URL | null {
  try {
    const socket = new URL(raw);
    if (socket.protocol !== "ws:" || !LOOPBACK.has(socket.hostname) || !socket.port) return null;
    if (socket.hash || socket.username || socket.password) return null;
    return socket;
  } catch {
    return null;
  }
}

/** DevTools for a page on This PC: its own debug server serves the frontend and the page socket. */
export function devtoolsUrlFor(
  webSocketDebuggerUrl: string,
  showScreencast: boolean,
): string | null {
  const socket = parseSocket(webSocketDebuggerUrl);
  if (!socket || socket.search || !/^\/devtools\/page\/[\w-]+$/.test(socket.pathname)) return null;
  const host = `${socket.hostname}:${socket.port}`;
  return frontendUrl(host, `${host}${socket.pathname}`, showScreencast);
}

/**
 * DevTools for a phone's page: the same bundled frontend, from the local pages' server on
 * `serverPort`, connected through Capubridge's loopback proxy (`/?token=…`). The phone's own debug
 * socket refuses a web page's Origin; the proxy drops it.
 */
export function phoneDevtoolsUrl(
  serverPort: number,
  proxyWsUrl: string,
  showScreencast: boolean,
): string | null {
  const socket = parseSocket(proxyWsUrl);
  if (!socket || socket.pathname !== "/" || !/^\?token=[\w-]+$/.test(socket.search)) return null;
  if (!Number.isInteger(serverPort) || serverPort <= 0 || serverPort > 65535) return null;
  return frontendUrl(
    `127.0.0.1:${serverPort}`,
    `${socket.hostname}:${socket.port}/${socket.search}`,
    showScreencast,
  );
}
