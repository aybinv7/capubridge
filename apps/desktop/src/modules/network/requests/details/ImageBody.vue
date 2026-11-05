<script setup lang="ts">
import { computed, ref } from "vue";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import ImageView from "@/shared/code-viewer/ImageView.vue";
import TextView from "@/shared/code-viewer/TextView.vue";
import ViewerToolbar from "@/shared/code-viewer/ViewerToolbar.vue";
import { SEGMENT_TEXT } from "@/shared/components/presentation/segmentText";
import { base64Lines } from "./bodyContent";
import { NETWORK_WRAP_KEY } from "./bodyViewer";

const props = defineProps<{
  blob: Blob;
  base64: string;
  mime: string;
  name: string;
  findSignal: number;
}>();

const mode = ref<"picture" | "base64">("picture");
const unreadable = ref(false);
const lines = computed(() =>
  mode.value === "base64" || unreadable.value ? base64Lines(props.base64) : "",
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <TextView
      v-if="mode === 'base64' || unreadable"
      :text="lines"
      language="plain"
      :wrap-storage-key="NETWORK_WRAP_KEY"
      find-label="Find in the Base64"
      :find-signal="props.findSignal"
      :notice="
        unreadable
          ? 'This picture cannot be shown here, so its bytes are shown as Base64.'
          : undefined
      "
    >
      <template #lead>
        <Segmented
          v-if="!unreadable"
          size="sm"
          active-variant="solid"
          aria-label="How to show the picture"
        >
          <SegmentedButton :active="false" :class="SEGMENT_TEXT" @click="mode = 'picture'">
            Picture
          </SegmentedButton>
          <SegmentedButton :active="true" :class="SEGMENT_TEXT">Base64</SegmentedButton>
        </Segmented>
      </template>
    </TextView>
    <template v-else>
      <ViewerToolbar>
        <template #start>
          <Segmented size="sm" active-variant="solid" aria-label="How to show the picture">
            <SegmentedButton :active="true" :class="SEGMENT_TEXT">Picture</SegmentedButton>
            <SegmentedButton :active="false" :class="SEGMENT_TEXT" @click="mode = 'base64'">
              Base64
            </SegmentedButton>
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
