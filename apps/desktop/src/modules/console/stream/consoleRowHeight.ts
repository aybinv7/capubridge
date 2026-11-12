import type { InlineBlock } from "@/lib/console/consoleLines";
import { ROW_HEIGHT } from "../list/useStreamList";

/** Height of each line after a row's first: `leading-4`. */
export const CONTINUATION_HEIGHT = 16;
/** Space under the last continuation line: `pb-1`. */
const BLOCK_PADDING = 4;

/**
 * The height a collapsed Console row takes for its inline block, matching ConsoleRow's layout,
 * so the virtual list places rows right before it measures them.
 */
export function consoleRowHeight(block: InlineBlock): number {
  const extra = block.lines.length - 1 + (block.hidden > 0 ? 1 : 0);
  return extra > 0 ? ROW_HEIGHT + extra * CONTINUATION_HEIGHT + BLOCK_PADDING : ROW_HEIGHT;
}
