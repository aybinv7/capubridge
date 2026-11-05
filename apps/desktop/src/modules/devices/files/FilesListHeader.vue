<script setup lang="ts">
import SortHeader from "@/shared/components/presentation/SortHeader.vue";
import type { FileSort, FileSortKey } from "./filePaths";
import { FILE_LIST_COLUMNS } from "./filesView";

const sort = defineModel<FileSort>("sort", { required: true });

function sortState(id: FileSortKey): "asc" | "desc" | false {
  return sort.value.key === id ? (sort.value.desc ? "desc" : "asc") : false;
}

function toggle(id: FileSortKey) {
  sort.value = { key: id, desc: sort.value.key === id ? !sort.value.desc : false };
}
</script>

<template>
  <div
    class="grid h-7 shrink-0 items-center gap-3 border-b border-border-subtle px-4"
    :class="FILE_LIST_COLUMNS"
  >
    <SortHeader label="Name" :state="sortState('name')" @toggle="toggle('name')" />
    <SortHeader label="Size" :state="sortState('size')" align="end" @toggle="toggle('size')" />
    <SortHeader label="Modified" :state="sortState('modified')" @toggle="toggle('modified')" />
    <span />
  </div>
</template>
