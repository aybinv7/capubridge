<script setup lang="ts">
import JsonView from "@/shared/code-viewer/JsonView.vue";
import TextView from "@/shared/code-viewer/TextView.vue";
import BinaryBody from "./BinaryBody.vue";
import type { BodyContent } from "./bodyContent";
import DetailsState from "./DetailsState.vue";
import ImageBody from "./ImageBody.vue";
import SvgBody from "./SvgBody.vue";

const props = defineProps<{
  content: BodyContent;
  name: string;
  emptyTitle: string;
  findSignal: number;
  findLabel: string;
  wrapStorageKey: string;
}>();

const emit = defineEmits<{ copyBase64: [] }>();
</script>

<template>
  <DetailsState v-if="props.content.kind === 'empty'" :title="props.emptyTitle" />
  <JsonView
    v-else-if="props.content.kind === 'json'"
    :text="props.content.text"
    :pretty="props.content.pretty"
    :parse="props.content.parse"
    :find-signal="props.findSignal"
    :wrap-storage-key="props.wrapStorageKey"
    :find-label="props.findLabel"
    allow-raw
  />
  <TextView
    v-else-if="props.content.kind === 'text'"
    :text="props.content.text"
    :language="props.content.language"
    :find-signal="props.findSignal"
    :wrap-storage-key="props.wrapStorageKey"
    :find-label="props.findLabel"
  />
  <ImageBody
    v-else-if="props.content.kind === 'image'"
    :blob="props.content.blob"
    :base64="props.content.base64"
    :mime="props.content.mime"
    :name="props.name"
    :find-signal="props.findSignal"
    :wrap-storage-key="props.wrapStorageKey"
  />
  <SvgBody
    v-else-if="props.content.kind === 'svg'"
    :text="props.content.text"
    :blob="props.content.blob"
    :name="props.name"
    :find-signal="props.findSignal"
    :wrap-storage-key="props.wrapStorageKey"
  />
  <BinaryBody
    v-else
    :base64="props.content.base64"
    :bytes="props.content.bytes"
    :mime="props.content.mime"
    :find-signal="props.findSignal"
    :wrap-storage-key="props.wrapStorageKey"
    @copy-base64="emit('copyBase64')"
  />
</template>
