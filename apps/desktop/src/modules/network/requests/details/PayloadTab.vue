<script setup lang="ts">
import { computed } from "vue";
import type { NetworkEntry } from "@/types/network.types";
import { requestName } from "../requestCells";
import BodyView from "./BodyView.vue";
import DetailsState from "./DetailsState.vue";
import { payloadContent } from "./bodyContent";
import { findHeader } from "./cookies";

const props = defineProps<{
  entry: NetworkEntry;
  body: string | undefined;
  loading: boolean;
  error: unknown;
  findSignal: number;
}>();

const emit = defineEmits<{ retry: [] }>();

const content = computed(() =>
  props.body === undefined
    ? null
    : payloadContent(props.body, findHeader(props.entry.requestHeaders, "content-type")),
);
const errorText = computed(() => (props.error ? String(props.error) : null));
</script>

<template>
  <DetailsState
    v-if="!props.entry.hasPostData"
    title="This request sent no body"
    :text="`${props.entry.method} requests usually carry their data in the address.`"
  />
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
  <BodyView
    v-else-if="content"
    :content="content"
    :name="requestName(props.entry.url)"
    empty-title="The body is empty"
    :find-signal="props.findSignal"
  />
</template>
