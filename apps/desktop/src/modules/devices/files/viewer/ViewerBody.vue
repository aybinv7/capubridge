<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { Download, ExternalLink, FileWarning, RotateCw, Scale } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import type { DeviceFileListEntry } from "../filePaths";
import HexView from "./HexView.vue";
import ImageView from "./ImageView.vue";
import JsonView from "./JsonView.vue";
import MediaView from "./MediaView.vue";
import SqliteView from "./SqliteView.vue";
import TextView from "./TextView.vue";
import ViewerStatus from "./ViewerStatus.vue";
import type { ViewerContent, ViewerState } from "./viewerContent";
import { readErrorSentence, tooLargeDetail } from "./viewerCopy";

const props = defineProps<{
  entry: DeviceFileListEntry;
  state: ViewerState;
  findSignal: number;
  databaseRoute: RouteLocationRaw | null;
}>();

const emit = defineEmits<{
  retry: [];
  download: [];
  openOnComputer: [];
  chooseApp: [];
  navigated: [];
}>();

const unreadable = shallowRef<ViewerContent | null>(null);

const content = computed(() => (props.state.status === "ready" ? props.state.content : null));
const failedMedia = computed(() => content.value !== null && unreadable.value === content.value);
const UNREADABLE_TITLES = {
  image: "This picture cannot be shown here",
  video: "This video cannot play here",
  audio: "This recording cannot play here",
} as const;

watch(content, () => {
  unreadable.value = null;
});

const failedTruncation = computed(() => {
  const media = content.value;
  if (!media || !("head" in media) || media.size === null || media.size <= media.head.length) {
    return null;
  }
  return { shown: media.head.length, total: media.size };
});

function markUnreadable() {
  unreadable.value = content.value;
}

const actionContent = "gap-2 [&>svg]:size-3.5";
</script>

<template>
  <div class="min-h-0 flex-1 overflow-hidden bg-surface-cut">
    <ViewerStatus
      v-if="props.state.status === 'loading' || props.state.status === 'idle'"
      busy
      :title="`Reading ${props.entry.name} from the phone`"
    />

    <ViewerStatus
      v-else-if="props.state.status === 'error'"
      alert
      :title="readErrorSentence(props.state.message)"
      :raw="props.state.message"
    >
      <template #icon><FileWarning :size="18" :stroke-width="1.6" /></template>
      <Button
        size="sm"
        variant="solid-fill"
        :content-class-name="actionContent"
        @click="emit('retry')"
      >
        <RotateCw :stroke-width="1.8" />
        Try again
      </Button>
    </ViewerStatus>

    <ViewerStatus
      v-else-if="props.state.status === 'too-large'"
      :title="`${props.entry.name} is too large to preview here`"
      :detail="tooLargeDetail(props.state.kind, props.state.cap, props.state.size)"
    >
      <template #icon><Scale :size="18" :stroke-width="1.6" /></template>
      <Button
        size="sm"
        variant="solid-fill"
        :content-class-name="actionContent"
        @click="emit('download')"
      >
        <Download :stroke-width="1.8" />
        Download
      </Button>
      <Button
        size="sm"
        variant="transparent"
        :content-class-name="actionContent"
        @click="emit('openOnComputer')"
      >
        <ExternalLink :stroke-width="1.8" />
        Open on this computer
      </Button>
    </ViewerStatus>

    <Transition
      v-else-if="content"
      appear
      enter-active-class="transition-opacity duration-200 ease-cladd-settle motion-reduce:transition-none"
      enter-from-class="opacity-0"
    >
      <div :key="props.entry.path" class="h-full">
        <HexView
          v-if="
            failedMedia &&
            (content.kind === 'image' || content.kind === 'video' || content.kind === 'audio')
          "
          :name="props.entry.name"
          :head="content.head"
          :truncation="failedTruncation"
          :title="UNREADABLE_TITLES[content.kind]"
          @open-on-computer="emit('openOnComputer')"
          @choose-app="emit('chooseApp')"
          @download="emit('download')"
        />
        <ImageView
          v-else-if="content.kind === 'image'"
          :content="content"
          :name="props.entry.name"
          @unreadable="markUnreadable"
        />
        <MediaView
          v-else-if="content.kind === 'video' || content.kind === 'audio'"
          :content="content"
          :name="props.entry.name"
          @unreadable="markUnreadable"
        />
        <JsonView
          v-else-if="content.kind === 'json'"
          :content="content"
          :find-signal="props.findSignal"
          @download="emit('download')"
        />
        <TextView
          v-else-if="content.kind === 'text'"
          :text="content.text"
          :language="content.language"
          :truncation="content.truncation"
          :find-signal="props.findSignal"
          @download="emit('download')"
        />
        <SqliteView
          v-else-if="content.kind === 'sqlite'"
          :content="content"
          :route="props.databaseRoute"
          @download="emit('download')"
          @open-on-computer="emit('openOnComputer')"
          @navigated="emit('navigated')"
        />
        <HexView
          v-else-if="content.kind === 'binary'"
          :name="props.entry.name"
          :head="content.head"
          :truncation="content.truncation"
          @open-on-computer="emit('openOnComputer')"
          @choose-app="emit('chooseApp')"
          @download="emit('download')"
        />
      </div>
    </Transition>
  </div>
</template>
