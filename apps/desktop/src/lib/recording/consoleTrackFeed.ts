import type { StreamFeed } from "@/lib/stream-feed";
import type { ConsoleEntry } from "@/types/console.types";

/**
 * Forwards every console entry appended after the call to `write`, in order, whatever the
 * console buffer's cap: the recording keeps what the buffer later evicts. Returns the
 * unsubscribe function.
 */
export function forwardConsoleTrack(
  feed: StreamFeed<ConsoleEntry>,
  write: (entry: ConsoleEntry) => void,
): () => void {
  return feed.subscribe((change) => {
    if (change.kind !== "append") {
      return;
    }
    for (const entry of change.items) {
      write(entry);
    }
  });
}
