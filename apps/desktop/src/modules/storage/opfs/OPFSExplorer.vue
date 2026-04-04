<script setup lang="ts">
import { ref, computed } from "vue";
import { FolderOpen, FileText, Database, HardDrive, Search } from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { mockOPFSEntries } from "@/data/mock-data";

const filter = ref("");
const selectedFile = ref<string | null>(null);

const selectedEntry = computed(() => mockOPFSEntries.find((e) => e.name === selectedFile.value));

const filtered = computed(() => {
  if (!filter.value) return mockOPFSEntries;
  const q = filter.value.toLowerCase();
  return mockOPFSEntries.filter(
    (e) => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q),
  );
});

function getFileIcon(type: string) {
  if (type === "database") return Database;
  if (type === "directory") return FolderOpen;
  return FileText;
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="h-8 shrink-0 border-b border-border bg-background flex items-center px-3 gap-2">
      <div
        class="flex items-center gap-1 bg-accent rounded-md px-2 py-0.5 max-w-xs border border-border focus-within:border-border transition-colors"
      >
        <Search class="w-3 h-3 text-muted-foreground" />
        <Input
          v-model="filter"
          class="h-5 text-3xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground"
          placeholder="Filter files…"
        />
      </div>
      <span class="text-3xs text-muted-foreground/40 font-mono">{{ filtered.length }} entries</span>
    </div>

    <div class="flex-1 overflow-auto">
      <table class="w-full text-2xs">
        <thead class="sticky top-0 z-10">
          <tr
            class="bg-accent text-left text-muted-foreground uppercase tracking-wider border-b border-border"
          >
            <th class="px-3 py-2 font-medium">Name</th>
            <th class="px-3 py-2 font-medium w-20">Type</th>
            <th class="px-3 py-2 font-medium w-20">Size</th>
            <th class="px-3 py-2 font-medium w-36">Modified</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in filtered"
            :key="entry.name"
            @click="selectedFile = selectedFile === entry.name ? null : entry.name"
            class="border-b border-border cursor-pointer transition-colors"
            :class="selectedFile === entry.name ? 'bg-secondary' : 'data-row'"
          >
            <td class="px-3 py-2 font-mono text-xs text-secondary-foreground">
              <div class="flex items-center gap-1.5">
                <component
                  :is="getFileIcon(entry.type)"
                  class="w-3 h-3 text-muted-foreground/40 shrink-0"
                />
                {{ entry.name }}
              </div>
            </td>
            <td class="px-3 py-2">
              <span
                class="text-2xs font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                >{{ entry.type }}</span
              >
            </td>
            <td class="px-3 py-2 text-muted-foreground font-mono">{{ entry.size }}</td>
            <td class="px-3 py-2 text-muted-foreground font-mono">{{ entry.modified }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
