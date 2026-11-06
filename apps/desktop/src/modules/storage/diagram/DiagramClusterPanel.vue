<script setup lang="ts">
import { ref, watch } from "vue";
import { Crosshair } from "lucide-vue-next";
import { Button, Input, Textarea } from "@capubridge/cladd";
import type { StorageGraphClusterSelection } from "@/types/storageGraph.types";

/** A group of tables: its name, what it is for, and its members. */
const props = defineProps<{ cluster: StorageGraphClusterSelection }>();

const emit = defineEmits<{
  save: [payload: { id: string; name: string; note?: string }];
  focusNode: [nodeId: string];
}>();

const name = ref("");
const note = ref("");

watch(
  () => props.cluster,
  (cluster) => {
    name.value = cluster.name;
    note.value = cluster.note ?? "";
  },
  { immediate: true },
);
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="emit('save', { id: cluster.id, name, note })">
    <label class="flex flex-col gap-1">
      <span class="text-2xs text-muted-foreground">Name</span>
      <Input v-model="name" size="md" />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-2xs text-muted-foreground">What it is for</span>
      <Textarea v-model="note" class="min-h-24" placeholder="Domain, owner, purpose" />
    </label>
    <div>
      <Button type="submit" size="sm" variant="solid-fill" color="brand">Save group</Button>
    </div>
    <section class="flex flex-col gap-1.5">
      <h3 class="text-2xs text-muted-foreground">Members · {{ cluster.memberIds.length }}</h3>
      <ul class="flex flex-col gap-px">
        <li v-for="(memberId, index) in cluster.memberIds" :key="memberId">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-inner px-2 py-1 text-left text-xs hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-signal-select"
            @click="emit('focusNode', memberId)"
          >
            <span class="truncate font-mono text-foreground">
              {{ cluster.memberNames[index] || memberId }}
            </span>
            <Crosshair
              :size="12"
              class="ml-auto shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
    </section>
  </form>
</template>
