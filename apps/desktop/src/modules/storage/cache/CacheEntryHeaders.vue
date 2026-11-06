<script setup lang="ts">
import { computed, ref } from "vue";
import { useNow, useStorage } from "@vueuse/core";
import { Link } from "@capubridge/cladd";
import type { CacheStorageEntryDetail } from "@capubridge/cdp-protocol";
import DetailsSection from "@/shared/http/DetailsSection.vue";
import KeyValueList from "@/shared/http/KeyValueList.vue";
import {
  REQUEST_FIRST,
  RESPONSE_FIRST,
  groupHeaders,
  type HeaderGroups,
} from "@/shared/http/headerGroups";
import { generalFacts } from "./cacheFacts";
import type { CacheRow } from "./cacheModel";

type SectionId = "general" | "response" | "request";
type HeaderSectionId = Exclude<SectionId, "general">;

/** General facts, then the response and the stored request headers, as Network shows them. */
const props = defineProps<{
  row: CacheRow;
  detail: CacheStorageEntryDetail | undefined;
  loading: boolean;
}>();

const collapsed = useStorage<SectionId[]>("capubridge:data:cache-collapsed-sections", []);
const unfolded = ref<HeaderSectionId[]>([]);
const now = useNow({ interval: 30_000 });

function isOpen(id: SectionId): boolean {
  return !collapsed.value.includes(id);
}

function toggle(id: SectionId) {
  collapsed.value = isOpen(id)
    ? [...collapsed.value, id]
    : collapsed.value.filter((section) => section !== id);
}

const general = computed(() => generalFacts(props.row, props.detail, now.value.getTime()));

function pairsOf(groups: HeaderGroups, id: HeaderSectionId) {
  const pairs = unfolded.value.includes(id)
    ? [...groups.surfaced, ...groups.folded]
    : groups.surfaced;
  const rows = pairs.map(([key, value]) => ({ key, value }));
  if (groups.cookie)
    rows.push({ key: id === "response" ? "set-cookie" : "cookie", value: groups.cookie });
  return rows;
}

const sections = computed(() => {
  const detail = props.detail;
  if (!detail) return [];
  const response = groupHeaders(detail.response.headers, RESPONSE_FIRST, "set-cookie");
  const request = groupHeaders(detail.requestHeaders, REQUEST_FIRST, "cookie");
  return [
    {
      id: "response" as const,
      title: "Response headers",
      groups: response,
      rows: pairsOf(response, "response"),
      empty: props.row.opaque
        ? "The browser hides an opaque response's headers from the page."
        : "The response has no headers.",
    },
    {
      id: "request" as const,
      title: "Request headers",
      groups: request,
      rows: pairsOf(request, "request"),
      empty: "No request headers were stored with this entry.",
    },
  ];
});
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="flex flex-col gap-5 p-4">
      <DetailsSection title="General" :open="isOpen('general')" @toggle="toggle('general')">
        <KeyValueList :rows="general" />
      </DetailsSection>
      <p v-if="props.loading && !props.detail" class="pl-5 text-xs text-muted-foreground">
        Reading the headers…
      </p>
      <DetailsSection
        v-for="section in sections"
        :key="section.id"
        :title="section.title"
        :count="section.groups.total"
        :open="isOpen(section.id)"
        @toggle="toggle(section.id)"
      >
        <KeyValueList v-if="section.rows.length" :rows="section.rows" mono />
        <p v-else class="text-xs text-muted-foreground">{{ section.empty }}</p>
        <Link
          v-if="section.groups.folded.length && !unfolded.includes(section.id)"
          class="mt-1.5 text-xs text-muted-foreground hover:text-foreground"
          @click="unfolded = [...unfolded, section.id]"
        >
          {{
            section.rows.length
              ? `${section.groups.folded.length} more`
              : `Show all ${section.groups.folded.length}`
          }}
        </Link>
      </DetailsSection>
    </div>
  </div>
</template>
