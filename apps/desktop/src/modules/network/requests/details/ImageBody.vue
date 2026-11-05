<script setup lang="ts">
import { ref } from "vue";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import ImageView from "@/shared/code-viewer/ImageView.vue";
import TextView from "@/shared/code-viewer/TextView.vue";
import ViewerToolbar from "@/shared/code-viewer/ViewerToolbar.vue";

const props = defineProps<{
  blob: Blob;
  base64: string;
  mime: string;
  name: string;
  findSignal: number;
}>();

const mode = ref<"picture" | "base64">("picture");
const unreadable = ref(false);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <TextView
      v-if="mode === 'base64' || unreadable"
      :text="props.base64"
      language="plain"
      :find-signal="props.findSignal"
      :notice="
        unreadable
          ? 'This picture cannot be shown here, so its bytes are shown as Base64.'
          : undefined
      "
    >
      <template #lead>
        <Segmented v-if="!unreadable" size="sm" aria-label="How to show the picture">
          <SegmentedButton :active="false" @click="mode = 'picture'">Picture</SegmentedButton>
          <SegmentedButton :active="true">Base64</SegmentedButton>
        </Segmented>
      </template>
    </TextView>
    <template v-else>
      <ViewerToolbar>
        <template #start>
          <Segmented size="sm" aria-label="How to show the picture">
            <SegmentedButton :active="true">Picture</SegmentedButton>
            <SegmentedButton :active="false" @click="mode = 'base64'">Base64</SegmentedButton>
          </Segmented>
          <span class="truncate font-mono text-2xs">{{ props.mime }}</span>
        </template>
      </ViewerToolbar>
      <div class="min-h-0 flex-1">
        <ImageView :blob="props.blob" :name="props.name" @unreadable="unreadable = true" />
      </div>
    </template>
  </div>
</template>
