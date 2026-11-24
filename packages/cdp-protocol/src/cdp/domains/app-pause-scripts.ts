import { jsLiteral } from "../evaluate.js";

/** The `sessionStorage` key that arms one paused load; the load consumes it. */
export const APP_PAUSE_KEY = "__capubridgePause";

/**
 * Runs before any script of every new document. Only the load armed with `token` (in this
 * tab's `sessionStorage`) is paused, and arming is one-shot, so a later reload starts the app
 * even when the script could not be removed. A paused page loads none of the app's code
 * (`window.stop()` aborts the parser) and cannot start workers, the only place a SQLite VFS
 * takes OPFS sync access handles. The browser's own `Worker` stays reachable for Capubridge.
 */
export function pauseScript(token: string): string {
  return `(() => {
  try {
    if (window !== window.top) return;
    const key = ${jsLiteral(APP_PAUSE_KEY)};
    const token = ${jsLiteral(token)};
    if (sessionStorage.getItem(key) !== token) return;
    sessionStorage.removeItem(key);
    const refuse = function () {
      throw new DOMException('The app is paused by Capubridge', 'NotAllowedError');
    };
    Object.defineProperty(window, '__capubridgeWorker', { value: window.Worker });
    Object.defineProperty(window, 'Worker', { value: refuse, configurable: true, writable: true });
    Object.defineProperty(window, 'SharedWorker', { value: refuse, configurable: true, writable: true });
    Object.defineProperty(window, '__capubridgePaused', { value: token });
    window.stop();
  } catch {}
})()`;
}

/** Arms the next load of this tab to pause; fails where the page has no `sessionStorage`. */
export function armScript(token: string): string {
  return `(() => {
  sessionStorage.setItem(${jsLiteral(APP_PAUSE_KEY)}, ${jsLiteral(token)});
  return true;
})()`;
}

/** Disarms a load that never happened, so the next reload starts the app. */
export function disarmScript(token: string): string {
  return `(() => {
  try {
    if (sessionStorage.getItem(${jsLiteral(APP_PAUSE_KEY)}) === ${jsLiteral(token)}) {
      sessionStorage.removeItem(${jsLiteral(APP_PAUSE_KEY)});
    }
  } catch {}
  return true;
})()`;
}

/** The page's origin once it is the load paused with `token`, otherwise `null`. */
export function probeScript(token: string): string {
  return `(window.__capubridgePaused === ${jsLiteral(token)} ? location.origin : null)`;
}

/** Whether the app's page (not a paused one) has finished loading. */
export function startedScript(): string {
  return "(!window.__capubridgePaused && document.readyState === 'complete')";
}
