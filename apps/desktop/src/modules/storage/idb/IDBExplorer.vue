<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useIDB } from "@/composables/useIDB";
import IDBTable from "./IDBTable.vue";
import IDBTableToolbar from "./IDBTableToolbar.vue";

const route = useRoute();
const { useRecords } = useIDB();

const dbName = computed(() => decodeURIComponent((route.params["db"] as string) ?? ""));
const storeName = computed(() => decodeURIComponent((route.params["store"] as string) ?? ""));
const page = ref(0);
const pageSize = ref(50);

const { data, isLoading, isError, error, refetch } = useRecords(dbName, storeName, page, pageSize);

function prevPage() {
  if (page.value > 0) page.value--;
}
function nextPage() {
  if (data.value?.hasMore) page.value++;
}
function handlePageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 0;
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- No selection -->
    <div
      v-if="!dbName || !storeName"
      class="flex flex-1 items-center justify-center text-[12px] text-muted-foreground/40"
    >
      Select a store from the sidebar
    </div>

    <template v-else>
      <IDBTableToolbar
        :store-name="storeName"
        :db-name="dbName"
        :is-loading="isLoading"
        :page="page"
        :page-size="pageSize"
        :has-more="data?.hasMore ?? false"
        :record-count="data?.records.length ?? 0"
        @refresh="refetch"
        @prev="prevPage"
        @next="nextPage"
        @page-size-change="handlePageSizeChange"
      />

      <!-- Error banner -->
      <div
        v-if="isError"
        class="shrink-0 border-b border-border bg-destructive/10 px-3 py-1.5 text-[11px] text-status-error"
      >
        {{ error?.message }}
      </div>

      <IDBTable :records="data?.records ?? []" :is-loading="isLoading" />
    </template>
  </div>
</template>
