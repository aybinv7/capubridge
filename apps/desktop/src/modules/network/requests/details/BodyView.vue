<script setup lang="ts">
import JsonView from "@/shared/code-viewer/JsonView.vue";
import TextView from "@/shared/code-viewer/TextView.vue";
import { formatBytes } from "../requestCells";
import type { BodyContent } from "./bodyContent";
import DetailsState from "./DetailsState.vue";
import ImageBody from "./ImageBody.vue";

const props = defineProps<{
  content: BodyContent;
  name: string;
  emptyTitle: string;
  findSignal: number;
}>();
</script>

<template>
  <DetailsState v-if="props.content.kind === 'empty'" :title="props.emptyTitle" />
  <JsonView
    v-else-if="props.content.kind === 'json'"
    :text="props.content.text"
    :pretty="props.content.pretty"
    :parse="props.content.parse"
    :find-signal="props.findSignal"
    allow-raw
  />
  <TextView
    v-else-if="props.content.kind === 'text'"
    :text="props.content.text"
    :language="props.content.language"
    :find-signal="props.findSignal"
  />
  <ImageBody
    v-else-if="props.content.kind === 'image'"
    :blob="props.content.blob"
    :base64="props.content.base64"
    :mime="props.content.mime"
    :name="props.name"
    :find-signal="props.findSignal"
  />
  <DetailsState
    v-else
    title="This body is not text"
    :text="`${formatBytes(props.content.bytes)} of ${props.content.mime}. It cannot be shown here.`"
  />
</template>
