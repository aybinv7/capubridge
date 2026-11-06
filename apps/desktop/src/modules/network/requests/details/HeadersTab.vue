<script setup lang="ts">
import { computed, ref } from "vue";
import { useStorage } from "@vueuse/core";
import { Link } from "@capubridge/cladd";
import type { NetworkEntry } from "@/types/network.types";
import DetailsSection from "@/shared/http/DetailsSection.vue";
import KeyValueList, { type KeyValueRow } from "@/shared/http/KeyValueList.vue";
import { parseRequestCookies, parseSetCookies } from "./cookies";
import {
  REQUEST_FIRST,
  RESPONSE_FIRST,
  groupHeaders,
  type HeaderGroups,
} from "@/shared/http/headerGroups";
import { generalFacts } from "./requestFacts";

type SectionId = "general" | "response" | "request";
type HeaderSectionId = Exclude<SectionId, "general">;

const props = defineProps<{ entry: NetworkEntry }>();

const emit = defineEmits<{ openCookies: [] }>();

const collapsed = useStorage<SectionId[]>("capubridge:network:collapsed-header-sections", []);
const unfolded = ref<HeaderSectionId[]>([]);

function isOpen(id: SectionId): boolean {
  return !collapsed.value.includes(id);
}

function toggle(id: SectionId) {
  collapsed.value = isOpen(id)
    ? [...collapsed.value, id]
    : collapsed.value.filter((section) => section !== id);
}

function unfold(id: HeaderSectionId) {
  unfolded.value = [...unfolded.value, id];
}

const general = computed<KeyValueRow[]>(() => generalFacts(props.entry));

function headerRows(groups: HeaderGroups, id: HeaderSectionId, cookies: number): KeyValueRow[] {
  const pairs = unfolded.value.includes(id)
    ? [...groups.surfaced, ...groups.folded]
    : groups.surfaced;
  const rows: KeyValueRow[] = pairs.map(([key, value]) => ({ key, value }));
  if (groups.cookie) {
    rows.push({
      key: id === "response" ? "set-cookie" : "cookie",
      value: `${cookies} ${cookies === 1 ? "cookie" : "cookies"}`,
      action: () => emit("openCookies"),
    });
  }
  return rows;
}

const response = computed(() => {
  const groups = groupHeaders(props.entry.responseHeaders, RESPONSE_FIRST, "set-cookie");
  const cookies = groups.cookie ? parseSetCookies(groups.cookie).length : 0;
  return { groups, rows: headerRows(groups, "response", cookies) };
});
const request = computed(() => {
  const groups = groupHeaders(props.entry.requestHeaders, REQUEST_FIRST, "cookie");
  const cookies = groups.cookie ? parseRequestCookies(groups.cookie).length : 0;
  return { groups, rows: headerRows(groups, "request", cookies) };
});

const sections = computed(() =>
  [
    { id: "response" as const, title: "Response headers", ...response.value },
    { id: "request" as const, title: "Request headers", ...request.value },
  ].filter((section) => section.groups.total > 0),
);
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="flex flex-col gap-5 p-4">
      <DetailsSection title="General" :open="isOpen('general')" @toggle="toggle('general')">
        <KeyValueList :rows="general" />
      </DetailsSection>
      <DetailsSection
        v-for="section in sections"
        :key="section.id"
        :title="section.title"
        :count="section.groups.total"
        :open="isOpen(section.id)"
        @toggle="toggle(section.id)"
      >
        <KeyValueList v-if="section.rows.length" :rows="section.rows" mono />
        <Link
          v-if="section.groups.folded.length && !unfolded.includes(section.id)"
          class="mt-1.5 text-xs text-muted-foreground hover:text-foreground"
          @click="unfold(section.id)"
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
