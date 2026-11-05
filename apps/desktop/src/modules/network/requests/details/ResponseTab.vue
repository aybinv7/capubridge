<script setup lang="ts">
import { computed, toRef } from "vue";
import type { NetworkEntry } from "@/types/network.types";
import { requestName } from "../requestNames";
import BodyView from "./BodyView.vue";
import DetailsState from "./DetailsState.vue";
import { responseContent, type RawBody } from "./bodyContent";
import { useBodyContent } from "./useBodyContent";

const props = defineProps<{
  entry: NetworkEntry;
  body: RawBody | null | undefined;
  loading: boolean;
  error: unknown;
  findSignal: number;
}>();

const emit = defineEmits<{ retry: []; copyBase64: [] }>();

const cacheKey = computed(() => `${props.entry.requestId}@${props.entry.startTimestamp}:response`);
const { content, formatting } = useBodyContent(
  toRef(props, "body"),
  cacheKey,
  (raw) => raw.body.length,
  (raw) => responseContent(raw, props.entry.mimeType),
);
const errorText = computed(() => (props.error ? String(props.error) : null));
</script>

<template>
  <DetailsState
    v-if="props.entry.isWebSocket"
    title="A WebSocket has no response body"
    text="Messages go both ways over the open connection; this request only opened it."
  />
  <DetailsState
    v-else-if="props.entry.state === 'failed'"
    :tone="props.entry.interrupted ? 'default' : 'error'"
    :title="
      props.entry.interrupted
        ? 'Capture restarted before this response arrived'
        : 'The request failed before a response arrived'
    "
    :detail="props.entry.interrupted ? null : (props.entry.errorText ?? null)"
  />
  <DetailsState
    v-else-if="props.entry.state !== 'finished'"
    loading
    title="Waiting for the response"
  />
  <DetailsState v-else-if="props.loading && !props.body" loading title="Reading the response" />
  <DetailsState
    v-else-if="errorText"
    tone="error"
    title="The app did not hand over this response"
    text="It may have dropped it from memory. Reload the page to capture it again."
    :detail="errorText"
    action-label="Try again"
    @action="emit('retry')"
  />
  <DetailsState v-else-if="formatting" loading title="Formatting the response" />
  <BodyView
    v-else-if="content"
    :content="content"
    :name="requestName(props.entry.url)"
    empty-title="The response has no body"
    :find-signal="props.findSignal"
    find-label="Find in the response"
    @copy-base64="emit('copyBase64')"
  />
</template>
