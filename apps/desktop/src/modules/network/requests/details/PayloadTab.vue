<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { NetworkEntry } from "@/types/network.types";
import { requestName } from "../requestNames";
import BodyView from "./BodyView.vue";
import DetailsSection from "./DetailsSection.vue";
import DetailsState from "./DetailsState.vue";
import KeyValueList, { type KeyValueRow } from "./KeyValueList.vue";
import { payloadContent } from "./bodyContent";
import { findHeader } from "./cookies";
import { queryParameters } from "./queryParameters";
import { useBodyContent } from "./useBodyContent";

const props = defineProps<{
  entry: NetworkEntry;
  body: string | undefined;
  loading: boolean;
  error: unknown;
  findSignal: number;
}>();

const emit = defineEmits<{ retry: [] }>();

const queryOpen = ref(true);
const query = computed<KeyValueRow[]>(() =>
  queryParameters(props.entry.url).map(([key, value]) => ({ key, value })),
);
const cacheKey = computed(() => `${props.entry.requestId}@${props.entry.startTimestamp}:payload`);
const { content, formatting } = useBodyContent(
  toRef(props, "body"),
  cacheKey,
  (text) => text.length,
  (text) => payloadContent(text, findHeader(props.entry.requestHeaders, "content-type")),
);
const errorText = computed(() => (props.error ? String(props.error) : null));
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      v-if="query.length"
      class="shrink-0 overflow-y-auto border-b border-border-subtle p-4"
      :class="props.entry.hasPostData ? 'max-h-[40%]' : 'min-h-0 flex-1'"
    >
      <DetailsSection
        title="Query parameters"
        :count="query.length"
        :open="queryOpen"
        @toggle="queryOpen = !queryOpen"
      >
        <KeyValueList :rows="query" mono />
      </DetailsSection>
    </div>
    <div v-if="props.entry.hasPostData || !query.length" class="min-h-0 flex-1">
      <DetailsState v-if="!props.entry.hasPostData" title="No payload" />
      <DetailsState
        v-else-if="props.loading && props.body === undefined"
        loading
        title="Reading the body"
      />
      <DetailsState
        v-else-if="errorText"
        tone="error"
        title="The app did not hand over this body"
        :detail="errorText"
        action-label="Try again"
        @action="emit('retry')"
      />
      <DetailsState v-else-if="formatting" loading title="Formatting the body" />
      <BodyView
        v-else-if="content"
        :content="content"
        :name="requestName(props.entry.url)"
        empty-title="The body is empty"
        :find-signal="props.findSignal"
        find-label="Find in the body"
      />
    </div>
  </div>
</template>
