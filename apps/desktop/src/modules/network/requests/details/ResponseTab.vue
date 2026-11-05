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
  <DetailsState v-if="props.entry.isWebSocket" title="No response body for a WebSocket" />
  <DetailsState
    v-else-if="props.entry.state === 'failed'"
    :title="
      props.entry.interrupted
        ? 'No response: capture restarted first'
        : 'No response: the request failed'
    "
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
    text="Reload the page to capture it again."
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
