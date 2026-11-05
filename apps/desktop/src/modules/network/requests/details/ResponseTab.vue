<script setup lang="ts">
import { computed } from "vue";
import type { NetworkEntry } from "@/types/network.types";
import { requestName } from "../requestCells";
import BodyView from "./BodyView.vue";
import DetailsState from "./DetailsState.vue";
import { responseContent, type RawBody } from "./bodyContent";

const props = defineProps<{
  entry: NetworkEntry;
  body: RawBody | null | undefined;
  loading: boolean;
  error: unknown;
  findSignal: number;
}>();

const emit = defineEmits<{ retry: [] }>();

const content = computed(() =>
  props.body ? responseContent(props.body, props.entry.mimeType) : null,
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
    tone="error"
    title="The request failed before a response arrived"
    :detail="props.entry.errorText ?? null"
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
  <BodyView
    v-else-if="content"
    :content="content"
    :name="requestName(props.entry.url)"
    empty-title="The response has no body"
    :find-signal="props.findSignal"
  />
</template>
