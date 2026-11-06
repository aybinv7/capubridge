<script setup lang="ts">
import { computed } from "vue";
import { toast } from "@/lib/toast";
import type { CacheStorageEntryDetail } from "@capubridge/cdp-protocol";
import BodyView from "@/shared/http/BodyView.vue";
import DetailsState from "@/shared/http/DetailsState.vue";
import { formatBytes } from "@/shared/format/numbers";
import { cacheBodyView } from "./cacheBody";
import type { CacheRow } from "./cacheModel";

const WRAP_KEY = "capubridge:data:viewer-wrap";

/** The cached body, read up to the cap, shown as Network shows a response. */
const props = defineProps<{
  row: CacheRow;
  detail: CacheStorageEntryDetail | undefined;
  loading: boolean;
  error: string | null;
  findSignal: number;
}>();

const emit = defineEmits<{ retry: []; readBody: [] }>();

const view = computed(() => (props.detail ? cacheBodyView(props.detail) : null));
const skippedText = computed(() => {
  const size = props.detail?.response.size;
  const amount = size === null || size === undefined ? "" : ` (${formatBytes(size)})`;
  const what = props.row.kind === "—" ? "Bodies of an unknown type" : `${props.row.kind} bodies`;
  return `${what}${amount} are read only when asked for, so stepping through the cache stays quick.`;
});

async function copyBase64() {
  const content = view.value?.content;
  if (!content || (content.kind !== "binary" && content.kind !== "image")) return;
  try {
    await navigator.clipboard.writeText(content.base64);
    toast.success("Copied the body as Base64");
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}
</script>

<template>
  <DetailsState
    v-if="props.row.opaque"
    title="The browser hides this body from the page"
    text="It is an opaque response (a no-cors request to another origin). The app can hand it to the page as is, but nothing can read it."
  />
  <DetailsState
    v-else-if="props.error"
    tone="error"
    title="Could not read the response"
    :detail="props.error"
    action-label="Try again"
    @action="emit('retry')"
  />
  <DetailsState
    v-else-if="props.loading && !props.detail"
    loading
    title="Reading the response from the phone"
  />
  <DetailsState
    v-else-if="props.detail && !props.detail.body && props.detail.response.size !== 0"
    title="The body was not read"
    :text="skippedText"
    action-label="Read the body"
    @action="emit('readBody')"
  />
  <div v-else-if="view" class="flex h-full min-h-0 flex-col">
    <p
      v-if="view.notice"
      class="shrink-0 border-b border-border-subtle px-4 py-1.5 text-2xs text-muted-foreground"
      role="status"
    >
      {{ view.notice }}
    </p>
    <div class="min-h-0 flex-1">
      <BodyView
        :content="view.content"
        :name="props.row.name"
        empty-title="The response has no body"
        :find-signal="props.findSignal"
        find-label="Find in the response"
        :wrap-storage-key="WRAP_KEY"
        @copy-base64="copyBase64"
      />
    </div>
  </div>
  <DetailsState v-else title="The response has no body" />
</template>
