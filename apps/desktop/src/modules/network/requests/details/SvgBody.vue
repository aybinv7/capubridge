<script setup lang="ts">
import { ref } from "vue";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import ImageView from "@/shared/code-viewer/ImageView.vue";
import TextView from "@/shared/code-viewer/TextView.vue";
import ViewerToolbar from "@/shared/code-viewer/ViewerToolbar.vue";
import { SEGMENT_TEXT } from "@/shared/components/presentation/segmentText";
import { NETWORK_WRAP_KEY } from "./bodyViewer";

const props = defineProps<{ text: string; blob: Blob; name: string; findSignal: number }>();

const mode = ref<"picture" | "text">("picture");
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <TextView
      v-if="mode === 'text'"
      :text="props.text"
      language="xml"
      :find-signal="props.findSignal"
      :wrap-storage-key="NETWORK_WRAP_KEY"
      find-label="Find in the response"
    >
      <template #lead>
        <Segmented size="sm" active-variant="solid" aria-label="How to show the SVG">
          <SegmentedButton :active="false" :class="SEGMENT_TEXT" @click="mode = 'picture'">
            Picture
          </SegmentedButton>
          <SegmentedButton :active="true" :class="SEGMENT_TEXT">Text</SegmentedButton>
        </Segmented>
      </template>
    </TextView>
    <template v-else>
      <ViewerToolbar>
        <template #start>
          <Segmented size="sm" active-variant="solid" aria-label="How to show the SVG">
            <SegmentedButton :active="true" :class="SEGMENT_TEXT">Picture</SegmentedButton>
            <SegmentedButton :active="false" :class="SEGMENT_TEXT" @click="mode = 'text'">
              Text
            </SegmentedButton>
          </Segmented>
          <span class="truncate font-mono text-2xs">image/svg+xml</span>
        </template>
      </ViewerToolbar>
      <div class="min-h-0 flex-1">
        <ImageView :blob="props.blob" :name="props.name" @unreadable="mode = 'text'" />
      </div>
    </template>
  </div>
</template>
