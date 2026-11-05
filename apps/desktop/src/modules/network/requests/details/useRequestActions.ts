import { ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import type { NetworkEntry } from "@/types/network.types";
import { useMockStore } from "../../stores/useMockStore";
import { mockRuleFromRequest } from "../../mock/mockFromRequest";
import { responseText, type RawBody } from "./bodyContent";
import { toCurl, toFetch } from "./copyAs";

export type CopyKind = "url" | "curl" | "fetch" | "response";

interface BodyReaders {
  fetchResponse: (entry: NetworkEntry) => Promise<RawBody | null>;
  fetchPayload: (entry: NetworkEntry) => Promise<string | null>;
}

const COPY_DONE: Record<CopyKind, string> = {
  url: "Address copied",
  curl: "Copied as cURL",
  fetch: "Copied as fetch",
  response: "Response copied",
};

/** Copies and "Mock this response" for a request, with toasts for what happened. */
export function useRequestActions(readers: BodyReaders) {
  const router = useRouter();
  const mock = useMockStore();
  const busy = ref(false);
  const canMock = router.hasRoute("network-mock");

  async function payloadOrNull(entry: NetworkEntry): Promise<string | null> {
    try {
      return await readers.fetchPayload(entry);
    } catch {
      return null;
    }
  }

  async function textFor(entry: NetworkEntry, kind: CopyKind): Promise<string | null> {
    if (kind === "url") return entry.url;
    if (kind === "curl") return toCurl(entry, await payloadOrNull(entry));
    if (kind === "fetch") return toFetch(entry, await payloadOrNull(entry));
    const body = await readers.fetchResponse(entry);
    return body ? responseText(body, entry.mimeType) : null;
  }

  async function copy(entry: NetworkEntry, kind: CopyKind) {
    busy.value = true;
    try {
      const text = await textFor(entry, kind);
      if (text === null) {
        toast("Nothing to copy", { description: "This response has no text body." });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast(COPY_DONE[kind]);
    } catch (error) {
      toast.error("Could not copy", { description: String(error) });
    } finally {
      busy.value = false;
    }
  }

  /**
   * Turns a finished request into a mock rule that answers the same way, then opens it in
   * Mocking. A body the app no longer holds leaves the rule's body empty instead of failing.
   */
  async function mockResponse(entry: NetworkEntry) {
    if (!canMock) return;
    busy.value = true;
    try {
      let body: string | null = null;
      let bodyMissing = false;
      try {
        const raw = await readers.fetchResponse(entry);
        body = raw ? responseText(raw, entry.mimeType) : null;
        bodyMissing = raw !== null && body === null;
      } catch {
        bodyMissing = true;
      }
      const id = mock.addRule(mockRuleFromRequest(entry, body));
      await router.push({ name: "network-mock", query: { rule: id } });
      const notes = [
        bodyMissing
          ? "The body could not be copied, so the rule answers with an empty body."
          : null,
        mock.interceptMode === "off" ? "Turn on interception to start answering with it." : null,
      ].filter((note): note is string => note !== null);
      toast("Mock rule created", { description: notes.join(" ") || undefined });
    } catch (error) {
      toast.error("Could not create the mock rule", { description: String(error) });
    } finally {
      busy.value = false;
    }
  }

  return { busy, canMock, copy, mockResponse };
}

export type RequestActions = ReturnType<typeof useRequestActions>;
