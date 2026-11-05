<script setup lang="ts">
import { computed } from "vue";
import { useStorage } from "@vueuse/core";
import type { NetworkEntry } from "@/types/network.types";
import { TONE_CLASS, initiatorWord, statusCell, typeWord } from "../requestCells";
import DetailsSection from "./DetailsSection.vue";
import KeyValueList, { type KeyValueRow } from "./KeyValueList.vue";
import { sortedHeaders } from "./cookies";
import { cacheSource } from "./timing";

type SectionId = "general" | "response" | "request";

const props = defineProps<{ entry: NetworkEntry }>();

const collapsed = useStorage<SectionId[]>("capubridge:network:collapsed-header-sections", []);

function isOpen(id: SectionId): boolean {
  return !collapsed.value.includes(id);
}

function toggle(id: SectionId) {
  collapsed.value = isOpen(id)
    ? [...collapsed.value, id]
    : collapsed.value.filter((section) => section !== id);
}

const general = computed<KeyValueRow[]>(() => {
  const entry = props.entry;
  const status = statusCell(entry);
  const rows: KeyValueRow[] = [
    { key: "Address", value: entry.url, clamp: true },
    { key: "Method", value: entry.method },
    {
      key: "Status",
      value: entry.httpStatus ? `${entry.httpStatus} ${entry.statusText}`.trim() : status.text,
      tone: TONE_CLASS[status.tone],
    },
    { key: "Type", value: [typeWord(entry), entry.mimeType].filter(Boolean).join(" · ") },
    {
      key: "Started by",
      value: entry.initiatorUrl
        ? `${initiatorWord(entry)} · ${entry.initiatorUrl}`
        : initiatorWord(entry),
    },
    { key: "Served from", value: cacheSource(entry) },
  ];
  if (entry.remoteAddress) rows.push({ key: "Remote address", value: entry.remoteAddress });
  if (entry.protocol) rows.push({ key: "Protocol", value: entry.protocol });
  if (entry.isWebSocket) rows.push({ key: "Frames", value: String(entry.wsFrameCount) });
  if (entry.errorText) rows.push({ key: "Error", value: entry.errorText, tone: "text-error" });
  return rows;
});

const responseHeaders = computed<KeyValueRow[]>(() =>
  sortedHeaders(props.entry.responseHeaders).map(([key, value]) => ({ key, value })),
);
const requestHeaders = computed<KeyValueRow[]>(() =>
  sortedHeaders(props.entry.requestHeaders).map(([key, value]) => ({ key, value })),
);
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="flex flex-col gap-5 p-4">
      <DetailsSection title="General" :open="isOpen('general')" @toggle="toggle('general')">
        <KeyValueList :rows="general" />
      </DetailsSection>
      <DetailsSection
        title="Response headers"
        :count="responseHeaders.length"
        :open="isOpen('response')"
        @toggle="toggle('response')"
      >
        <KeyValueList v-if="responseHeaders.length" :rows="responseHeaders" mono />
        <p v-else class="text-xs text-muted-foreground">No response headers yet.</p>
      </DetailsSection>
      <DetailsSection
        title="Request headers"
        :count="requestHeaders.length"
        :open="isOpen('request')"
        @toggle="toggle('request')"
      >
        <KeyValueList v-if="requestHeaders.length" :rows="requestHeaders" mono />
        <p v-else class="text-xs text-muted-foreground">No request headers were reported.</p>
      </DetailsSection>
    </div>
  </div>
</template>
