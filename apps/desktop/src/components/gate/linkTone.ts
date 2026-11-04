import type { LinkTone } from "@/lib/gates/link";

/** Text colour per link tone; `live` stays a signal, the rest are outcome states. */
export const LINK_TONE_TEXT: Record<LinkTone, string> = {
  live: "text-signal-live",
  waiting: "text-warning",
  warning: "text-warning",
  error: "text-error",
  muted: "text-muted-foreground",
};

/** Mark shape per link tone, so the state never depends on hue alone. */
export const LINK_TONE_MARK: Record<LinkTone, string> = {
  live: "rounded-full bg-signal-live",
  waiting: "rounded-full ring-1 ring-inset ring-warning",
  warning: "rounded-none bg-warning",
  error: "rounded-none bg-error",
  muted: "rounded-full bg-[var(--fg-subtle)]",
};
