/**
 * Text treatment for a Cladd `SegmentedButton`, matching the section tabs: unselected segments
 * read muted at normal weight, the selected one in the foreground at medium weight, so the choice
 * is legible without relying on the raised surface alone.
 */
export const SEGMENT_TEXT =
  "font-normal text-muted-foreground data-active:font-medium data-active:text-foreground";
