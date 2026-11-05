import type { Color } from "@capubridge/cladd";
import type { AppPresence } from "@/lib/gates/presence";
import type { WebViewSource } from "./webViewSample";
import type { WebViewMetricsStatus } from "./useWebViewMetrics";

export interface WebViewStatusCopy {
  label: string;
  detail: string;
  color: Color | undefined;
  variant: "solid" | "hollow";
  /** Where the numbers come from, for a tooltip. */
  sourceHint: string | null;
}

const SOURCE_HINTS: Record<WebViewSource, string | null> = {
  none: null,
  performance: "Read through Chrome's Performance domain",
  "runtime-fallback": "Read through the runtime heap and DOM counters",
};

/**
 * The WebView section's state word. An app in the background is said first: Android may freeze
 * it, so readings that keep arriving are not called live.
 */
export function webViewStatusCopy(
  status: WebViewMetricsStatus,
  source: WebViewSource,
  presence: AppPresence,
): WebViewStatusCopy {
  const sourceHint = SOURCE_HINTS[source];
  if (status !== "idle" && status !== "waiting" && presence === "background") {
    return {
      label: "In the background",
      detail: "Readings may be frozen until the app is back on screen.",
      color: undefined,
      variant: "hollow",
      sourceHint,
    };
  }
  switch (status) {
    case "idle":
      return { label: "Paused", detail: "", color: undefined, variant: "hollow", sourceHint };
    case "waiting":
      return {
        label: "Waiting",
        detail: "Connect to a WebView to see its memory.",
        color: undefined,
        variant: "hollow",
        sourceHint,
      };
    case "active":
      return {
        label: "Live",
        detail: "Read from the page once a second.",
        color: "lime",
        variant: "solid",
        sourceHint,
      };
    case "degraded":
      return {
        label: "Partial",
        detail:
          source === "none"
            ? "This WebView does not report its memory."
            : "This WebView reports only some of its numbers.",
        color: "yellow",
        variant: "solid",
        sourceHint,
      };
    case "error":
      return {
        label: "Stopped",
        detail: "The WebView stopped answering.",
        color: "red",
        variant: "solid",
        sourceHint,
      };
  }
}
