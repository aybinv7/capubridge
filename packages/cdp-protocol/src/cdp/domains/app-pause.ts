import type { CDPClient } from "../client.js";
import { evaluateChecked } from "../evaluate.js";
import {
  armScript,
  disarmScript,
  pauseScript,
  probeScript,
  startedScript,
} from "./app-pause-scripts.js";

/** How long the paused load may take to appear before the pause gives up. */
export const APP_PAUSE_TIMEOUT_MS = 20_000;
const PROBE_INTERVAL_MS = 150;

/** The page could not be paused; the app was left running (or started again). */
export class AppPauseError extends Error {
  override name = "AppPauseError";
}

export interface AppPauseOutcome<T> {
  value: T;
  /** The app was started again. `false` when the last reload failed: the page stays paused. */
  restarted: boolean;
}

function newToken(): string {
  return globalThis.crypto.randomUUID();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs work while the app is paused: the page reloads with none of the app's code (see
 * `pauseScript`), so the workers that held its OPFS files open are gone, then reloads again to
 * start the app. Whatever the app kept only in memory is lost; what it stored stays.
 */
export class AppPause {
  constructor(
    private client: CDPClient,
    private timeoutMs = APP_PAUSE_TIMEOUT_MS,
  ) {}

  private evaluate(expression: string) {
    return evaluateChecked(this.client, { expression, returnByValue: true });
  }

  /** Resolves the paused page's origin once the load armed with `token` is showing. */
  private async waitPaused(token: string): Promise<string> {
    const deadline = Date.now() + this.timeoutMs;
    let last = "";
    while (Date.now() < deadline) {
      try {
        const { result } = await this.evaluate(probeScript(token));
        if (typeof result.value === "string") return result.value;
      } catch (error) {
        last = messageOf(error);
      }
      await sleep(PROBE_INTERVAL_MS);
    }
    throw new AppPauseError(
      `The page did not come back paused within ${Math.round(this.timeoutMs / 1000)} s${last ? ` (${last})` : ""}.`,
    );
  }

  /**
   * Waits (without failing) until the restarted app's page has loaded, so reads that follow
   * reach the app and not the page being torn down.
   */
  private async waitStarted(): Promise<void> {
    const deadline = Date.now() + this.timeoutMs / 2;
    while (Date.now() < deadline) {
      const started = await this.evaluate(startedScript()).then(
        ({ result }) => result.value === true,
        () => false,
      );
      if (started) return;
      await sleep(PROBE_INTERVAL_MS);
    }
  }

  private async restart(identifier: string, token: string): Promise<boolean> {
    await this.client
      .send("Page.removeScriptToEvaluateOnNewDocument", { identifier })
      .catch(() => undefined);
    await this.evaluate(disarmScript(token)).catch(() => undefined);
    try {
      await this.client.send("Page.reload", { ignoreCache: false });
    } catch {
      return false;
    }
    await this.waitStarted();
    return true;
  }

  /**
   * Pauses the app, runs `work` with the paused page's origin, and starts the app again, also
   * when `work` fails (then its error is rethrown). Refuses with `AppPauseError` when the page
   * cannot be paused, after starting the app again.
   */
  async run<T>(work: (origin: string) => Promise<T>): Promise<AppPauseOutcome<T>> {
    const token = newToken();
    try {
      await this.evaluate(armScript(token));
    } catch (error) {
      throw new AppPauseError(`The page cannot be paused: ${messageOf(error)}`);
    }
    let identifier: string;
    try {
      ({ identifier } = await this.client.send<{ identifier: string }>(
        "Page.addScriptToEvaluateOnNewDocument",
        { source: pauseScript(token) },
      ));
    } catch (error) {
      await this.evaluate(disarmScript(token)).catch(() => undefined);
      throw new AppPauseError(`The page cannot be paused: ${messageOf(error)}`);
    }
    let value: T;
    try {
      await this.client.send("Page.reload", { ignoreCache: false });
      const origin = await this.waitPaused(token);
      value = await work(origin);
    } catch (error) {
      await this.restart(identifier, token);
      throw error;
    }
    return { value, restarted: await this.restart(identifier, token) };
  }
}
