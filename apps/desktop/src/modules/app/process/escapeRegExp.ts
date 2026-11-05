/** `text` with every regular-expression character escaped, for building a pattern from data. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
