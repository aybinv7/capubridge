<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { Download, ExternalLink, FileWarning, RotateCw, Scale } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import HexView from "./HexView.vue";
import ImageView from "@/shared/code-viewer/ImageView.vue";
import JsonView from "@/shared/code-viewer/JsonView.vue";
import MediaView from "./MediaView.vue";
import SqliteView from "./SqliteView.vue";
import TextView from "@/shared/code-viewer/TextView.vue";
import ViewerStatus from "./ViewerStatus.vue";
import type { ViewerActions } from "./viewerActions";
import type { ViewerContent, ViewerState } from "./viewerContent";
import { truncationNote } from "./readPlan";
import { readErrorSentence, tooLargeDetail } from "./viewerCopy";

const props = defineProps<{
  name: string;
  /** Identifies the open file; a new path replays the entrance transition. */
  path: string;
  state: ViewerState;
  findSignal: number;
  actions: ViewerActions;
}>();

const emit = defineEmits<{
  retry: [];
  download: [];
  openOnComputer: [];
  chooseApp: [];
  openDatabase: [];
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
      :title="`Reading ${props.name} from the phone`"
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
        color="brand"
        :content-class-name="actionContent"
        @click="emit('retry')"
      >
        <RotateCw :stroke-width="1.8" />
        Try again
      </Button>
    </ViewerStatus>

    <ViewerStatus
      v-else-if="props.state.status === 'too-large'"
      :title="`${props.name} is too large to preview here`"
      :detail="tooLargeDetail(props.state.kind, props.state.cap, props.state.size)"
    >
      <template #icon><Scale :size="18" :stroke-width="1.6" /></template>
      <Button
        v-if="props.actions.download"
        size="sm"
        variant="solid-fill"
        color="brand"
        :content-class-name="actionContent"
        @click="emit('download')"
      >
        <Download :stroke-width="1.8" />
        Download
      </Button>
      <Button
        v-if="props.actions.openOnComputer"
        size="sm"
        :variant="props.actions.download ? 'transparent' : 'solid-fill'"
        :color="props.actions.download ? undefined : 'brand'"
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
      <div :key="props.path" class="h-full">
        <HexView
          v-if="
            failedMedia &&
            (content.kind === 'image' || content.kind === 'video' || content.kind === 'audio')
          "
          :name="props.name"
          :head="content.head"
          :truncation="failedTruncation"
          :title="UNREADABLE_TITLES[content.kind]"
          :actions="props.actions"
          @open-on-computer="emit('openOnComputer')"
          @choose-app="emit('chooseApp')"
          @download="emit('download')"
        />
        <ImageView
          v-else-if="content.kind === 'image'"
          :blob="content.blob"
          :name="props.name"
          @unreadable="markUnreadable"
        />
        <MediaView
          v-else-if="content.kind === 'video' || content.kind === 'audio'"
          :content="content"
          :name="props.name"
          @unreadable="markUnreadable"
        />
        <JsonView
          v-else-if="content.kind === 'json'"
          :text="content.text"
          :pretty="content.pretty"
          :parse="content.parse"
          :truncation-note="content.truncation && truncationNote(content.truncation)"
          :find-signal="props.findSignal"
          @download="emit('download')"
        />
        <TextView
          v-else-if="content.kind === 'text'"
          :text="content.text"
          :language="content.language"
          :truncation-note="content.truncation && truncationNote(content.truncation)"
          :find-signal="props.findSignal"
          @download="emit('download')"
        />
        <SqliteView
          v-else-if="content.kind === 'sqlite'"
          :content="content"
          :actions="props.actions"
          @download="emit('download')"
          @open-on-computer="emit('openOnComputer')"
          @open-database="emit('openDatabase')"
        />
        <HexView
          v-else-if="content.kind === 'binary'"
          :name="props.name"
          :head="content.head"
          :truncation="content.truncation"
          :actions="props.actions"
          @open-on-computer="emit('openOnComputer')"
          @choose-app="emit('chooseApp')"
          @download="emit('download')"
        />
      </div>
    </Transition>
  </div>
</template>
