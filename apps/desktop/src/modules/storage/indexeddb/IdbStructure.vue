<script setup lang="ts">
import { computed } from "vue";
import type { StoreInfo } from "@capubridge/cdp-protocol";
import FactList from "@/shared/facts/FactList.vue";
import type { Fact } from "@/shared/facts/fact";

/** How a store is built: its key, whether keys are generated, and its indexes. */
const props = defineProps<{ info: StoreInfo | undefined }>();

function pathText(path: string | string[] | null): string {
  if (path === null) return "None: keys are given separately from the values";
  return Array.isArray(path) ? `[${path.join(", ")}]` : path;
}

const facts = computed<Fact[]>(() => {
  const info = props.info;
  if (!info) return [];
  return [
    {
      key: "key",
      label: "Key",
      value: pathText(info.keyPath),
      mono: info.keyPath !== null,
      copy: pathText(info.keyPath),
    },
    {
      key: "auto",
      label: "Generated keys",
      value: info.autoIncrement ? "Yes, numbers counted up" : "No",
      detail:
        info.autoIncrement && info.keyGeneratorValue !== undefined
          ? `next is ${info.keyGeneratorValue}`
          : undefined,
    },
    { key: "records", label: "Records", value: info.recordCount.toLocaleString("en-US") },
  ];
});
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
    <p v-if="!info" class="text-xs text-muted-foreground">Reading the store…</p>
    <div v-else class="flex max-w-3xl flex-col gap-6">
      <FactList title="Store" :facts="facts" />
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-foreground">Indexes</h2>
        <p v-if="info.indexes.length === 0" class="text-xs text-muted-foreground">
          No indexes: records can only be looked up by their key.
        </p>
        <table v-else class="w-full text-left text-xs">
          <thead class="text-2xs text-muted-foreground">
            <tr class="border-b border-border-subtle">
              <th class="py-1.5 pr-4 font-normal">Name</th>
              <th class="py-1.5 pr-4 font-normal">Field</th>
              <th class="py-1.5 pr-4 font-normal">Unique</th>
              <th class="py-1.5 font-normal">One entry per list item</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            <tr v-for="index in info.indexes" :key="index.name">
              <td class="py-1.5 pr-4 text-foreground">{{ index.name }}</td>
              <td class="py-1.5 pr-4 font-mono text-muted-foreground">
                {{ pathText(index.keyPath) }}
              </td>
              <td class="py-1.5 pr-4 text-muted-foreground">{{ index.unique ? "Yes" : "No" }}</td>
              <td class="py-1.5 text-muted-foreground">{{ index.multiEntry ? "Yes" : "No" }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>
