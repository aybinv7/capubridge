/**
 * Whether a key event belongs to something that types or has its own keys: a text field, an
 * editable region, or a menu. List shortcuts leave those alone and handle everything else,
 * including keys pressed after clicking a button inside a row.
 */
export function ownsKeys(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"))
    return true;
  return target.closest("[role='menu'], [role='menubar'], [role='combobox']") !== null;
}
