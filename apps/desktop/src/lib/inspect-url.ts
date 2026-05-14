export function normalizeInspectableUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost(?::|\/|$)/i.test(trimmed)) return `http://${trimmed}`;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::|\/|$)/.test(trimmed)) return `http://${trimmed}`;
  if (/^\[[0-9a-f:]+\](?::|\/|$)/i.test(trimmed)) return `http://${trimmed}`;
  if (/^[\w.-]+\.[a-z]{2,}(?::|\/|$)/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}
