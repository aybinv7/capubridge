import { computed, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { NetworkDomain } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import type { NetworkEntry } from "@/types/network.types";
import { useNetworkStore } from "../../stores/useNetworkStore";
import type { RawBody } from "./bodyContent";
import type { DetailTab } from "./detailTabs";

const BODY_STALE_MS = 60_000;

/** Whether the app can still hand over a response body for this request. */
export function hasResponseBody(entry: NetworkEntry): boolean {
  return entry.state === "finished" && !entry.isWebSocket;
}

/**
 * Request and response bodies of the selected request, read from the app over CDP only while
 * their tab is open, and on demand for copies and mocks. Each read is cached by target and
 * request, and text bodies are handed to the store so "search bodies" can find them.
 */
export function useRequestBodies(entry: Ref<NetworkEntry | null>, tab: Ref<DetailTab>) {
  const store = useNetworkStore();
  const targets = useTargetsStore();
  const queryClient = useQueryClient();
  const { getClient } = useCDP();

  const targetId = computed(() => targets.cdpTargetId);
  const requestId = computed(() => entry.value?.requestId ?? "");

  function domain(): NetworkDomain {
    const client = targetId.value ? getClient(targetId.value) : undefined;
    if (!client) throw new Error("The connection to the app's DevTools is closed");
    return new NetworkDomain(client);
  }

  function responseOptions(id: string) {
    return {
      queryKey: ["net-response-body", targetId.value, id] as const,
      queryFn: async (): Promise<RawBody> => {
        const body = await domain().getResponseBody(id);
        if (!body.base64Encoded) store.cacheBody(id, body.body);
        return body;
      },
      staleTime: BODY_STALE_MS,
      retry: false,
    };
  }

  function payloadOptions(id: string) {
    return {
      queryKey: ["net-post-data", targetId.value, id] as const,
      queryFn: async (): Promise<string> => {
        const text = await domain().getRequestPostData(id);
        store.cacheBody(`${id}:payload`, text);
        return text;
      },
      staleTime: BODY_STALE_MS,
      retry: false,
    };
  }

  const response = useQuery({
    queryKey: computed(() => ["net-response-body", targetId.value, requestId.value] as const),
    queryFn: () => responseOptions(requestId.value).queryFn(),
    enabled: computed(
      () =>
        !!targetId.value &&
        !!entry.value &&
        hasResponseBody(entry.value) &&
        tab.value === "response",
    ),
    staleTime: BODY_STALE_MS,
    retry: false,
  });

  const payload = useQuery({
    queryKey: computed(() => ["net-post-data", targetId.value, requestId.value] as const),
    queryFn: () => payloadOptions(requestId.value).queryFn(),
    enabled: computed(
      () => !!targetId.value && !!entry.value?.hasPostData && tab.value === "payload",
    ),
    staleTime: BODY_STALE_MS,
    retry: false,
  });

  /** The response body of a request, from the cache or the app; null when it has none. */
  async function fetchResponse(target: NetworkEntry): Promise<RawBody | null> {
    if (!hasResponseBody(target)) return null;
    return queryClient.fetchQuery(responseOptions(target.requestId));
  }

  /** The request body of a request, from the cache or the app; null when it sent none. */
  async function fetchPayload(target: NetworkEntry): Promise<string | null> {
    if (!target.hasPostData) return null;
    return queryClient.fetchQuery(payloadOptions(target.requestId));
  }

  return { response, payload, fetchResponse, fetchPayload };
}

export type RequestBodies = ReturnType<typeof useRequestBodies>;
