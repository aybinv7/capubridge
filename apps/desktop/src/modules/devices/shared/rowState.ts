/** A selected row or tile: the selection tint with a thin selection line, above any hover. */
export const ROW_SELECTED =
  "bg-accent-soft text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--signal-select)_45%,transparent)]";

/** An unselected row or tile: a quiet lift on hover, one level below the selection. */
export const ROW_IDLE = "hover:bg-cladd-surface-hover";

/** Classes for a row or tile by its selection. */
export function rowStateClass(selected: boolean): string {
  return selected ? ROW_SELECTED : ROW_IDLE;
}

/** A DOM id for a listbox option, from any key, unique within one list. */
export function optionId(listId: string, key: string): string {
  return `${listId}-${key.replace(/[^\w-]/g, "_")}`;
}
