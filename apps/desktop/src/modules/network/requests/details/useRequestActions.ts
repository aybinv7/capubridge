import { ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "@/lib/toast";
import { utf8ToBase64 } from "@/lib/base64";
import { useTargetsStore } from "@/stores/targets.store";
import type { NetworkEntry } from "@/types/network.types";
import { useMockStore } from "../../stores/useMockStore";
import {
  mockAvailability,
  mockRuleFromRequest,
  mockRuleNotes,
  type MockSourceBody,
} from "../../mock/mockFromRequest";
import { responseText, type RawBody } from "@/shared/http/bodyContent";
import { toCurl, toFetch } from "./copyAs";

export type CopyKind = "url" | "curl" | "fetch" | "response" | "base64";

interface BodyReaders {
  fetchResponse: (entry: NetworkEntry) => Promise<RawBody | null>;
  fetchPayload: (entry: NetworkEntry) => Promise<string | null>;
}

const COPY_DONE: Record<CopyKind, string> = {
  url: "Address copied",
  curl: "Copied as cURL",
  fetch: "Copied as fetch",
  response: "Response copied",
  base64: "Response copied as Base64",
};

/** Copies and "Mock this response" for a request, with toasts for what happened. */
export function useRequestActions(readers: BodyReaders) {
  const router = useRouter();
  const mock = useMockStore();
  const targets = useTargetsStore();
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
    if (!body) return null;
    if (kind === "base64") return body.base64Encoded ? body.body : utf8ToBase64(body.body);
    return responseText(body, entry.mimeType);
  }

  async function copy(entry: NetworkEntry, kind: CopyKind) {
    busy.value = true;
    try {
      const text = await textFor(entry, kind);
      if (text === null) {
        toast("Nothing to copy", {
          description:
            kind === "response"
              ? "This response is not text. Use Copy as Base64 for its bytes."
              : "This response has no body.",
        });
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

  async function sourceBody(
    entry: NetworkEntry,
  ): Promise<{ body: MockSourceBody | null; missing: boolean }> {
    try {
      const raw = await readers.fetchResponse(entry);
      if (!raw) return { body: null, missing: false };
      const text = responseText(raw, entry.mimeType);
      return {
        body: text !== null ? { body: text, base64Encoded: false } : raw,
        missing: false,
      };
    } catch {
      return { body: null, missing: true };
    }
  }

  function turnOnAction() {
    if (mock.interceptMode !== "off") return undefined;
    if (!targets.cdpTargetId) return undefined;
    return {
      label: "Intercept",
      onClick: () => {
        mock.interceptMode = "cdp";
      },
    };
  }

  /**
   * Turns a finished request into a mock rule that answers the same way, then opens it in
   * Mocking. A body the app no longer holds leaves the rule's body empty instead of failing.
   */
  async function mockResponse(entry: NetworkEntry) {
    if (!canMock) return;
    const availability = mockAvailability(entry);
    if (!availability.ok) {
      toast("This response cannot be mocked", { description: availability.reason });
      return;
    }
    busy.value = true;
    try {
      const { body, missing } = await sourceBody(entry);
      const rule = mockRuleFromRequest(entry, body);
      const id = mock.addRule(rule);
      await router.push({ name: "network-mock", query: { rule: id } });
      const notes = [
        ...mockRuleNotes(entry, rule),
        missing ? "The body could not be read, so the rule answers with an empty body." : null,
        mock.interceptMode === "off" ? "Interception is off, so it answers nothing yet." : null,
      ].filter((note): note is string => note !== null);
      toast("Mock rule created", {
        description: notes.join(" ") || undefined,
        action: turnOnAction(),
      });
    } catch (error) {
      toast.error("Could not create the mock rule", { description: String(error) });
    } finally {
      busy.value = false;
    }
  }

  return { busy, canMock, copy, mockResponse };
}

export type RequestActions = ReturnType<typeof useRequestActions>;
