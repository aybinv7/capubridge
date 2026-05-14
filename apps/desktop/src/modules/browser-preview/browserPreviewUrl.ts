const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function normalizePreviewUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost(?::|\/|$)/i.test(trimmed)) return `http://${trimmed}`;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::|\/|$)/.test(trimmed)) return `http://${trimmed}`;
  if (/^\[[0-9a-f:]+\](?::|\/|$)/i.test(trimmed)) return `http://${trimmed}`;
  if (/^[\w.-]+\.[a-z]{2,}(?::|\/|$)/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

export function isLocalPreviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return LOCAL_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

export async function probePreviewUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 900);

  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
