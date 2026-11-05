import type { CDPClient } from "@capubridge/cdp-protocol";

const READY_TIMEOUT_MS = 8000;
const MAX_ICON_BYTES = 32_000;

const IDENTITY_SCRIPT = `(async () => {
  const deadline = Date.now() + ${READY_TIMEOUT_MS};
  while (document.readyState !== "complete" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const links = Array.from(document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]'));
  const sized = links
    .map((link) => ({ href: link.href, size: parseInt((link.sizes && link.sizes.value) || "0", 10) || 0 }))
    .sort((a, b) => Math.abs(a.size - 32) - Math.abs(b.size - 32));
  const href = (sized[0] && sized[0].href) || new URL("/favicon.ico", location.href).href;
  let icon = null;
  try {
    const response = await fetch(href, { cache: "force-cache" });
    const blob = response.ok ? await response.blob() : null;
    if (blob && blob.size > 0 && blob.size <= ${MAX_ICON_BYTES} && blob.type.startsWith("image/")) {
      icon = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }
  } catch {}
  return { title: document.title || "", icon };
})()`;

/**
 * Asks a page for its title and icon once it has loaded. The icon comes back as a data URL read by
 * the page itself, so Capubridge never loads anything from the page's site.
 */
export async function readLocalPageIdentity(
  client: CDPClient,
): Promise<{ title: string; icon: string | null }> {
  const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
    expression: IDENTITY_SCRIPT,
    awaitPromise: true,
    returnByValue: true,
  });
  const value = result.result.value as { title?: unknown; icon?: unknown } | undefined;
  return {
    title: typeof value?.title === "string" ? value.title : "",
    icon:
      typeof value?.icon === "string" && value.icon.startsWith("data:image/") ? value.icon : null,
  };
}
