/** The console drawer's two views, in switcher order. */
export const drawerViewIds = ["logs", "console"] as const;

export type DrawerView = (typeof drawerViewIds)[number];

/** What the Console view lists: the whole stream, or errors grouped by message and frame. */
export type ConsoleMode = "stream" | "errors";

export function isDrawerView(value: string | null | undefined): value is DrawerView {
  return typeof value === "string" && (drawerViewIds as readonly string[]).includes(value);
}

/**
 * The drawer view an older name or route asks for: `logcat` is Logs; `console`, `output`,
 * `repl` and `exceptions` are the Console view (exceptions in its Errors mode).
 */
export function drawerViewFor(value: string | null | undefined): {
  view: DrawerView;
  mode?: ConsoleMode;
} | null {
  if (value === "logs" || value === "logcat") return { view: "logs" };
  if (value === "exceptions" || value === "errors") return { view: "console", mode: "errors" };
  if (value === "console" || value === "output" || value === "repl") return { view: "console" };
  return null;
}
