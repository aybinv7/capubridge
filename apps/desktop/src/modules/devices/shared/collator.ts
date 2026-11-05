const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Compares names the way people read them: case-insensitive, numbers by value. */
export function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}
