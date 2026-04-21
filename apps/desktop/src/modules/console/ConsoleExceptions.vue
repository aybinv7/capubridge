<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { AlertTriangle, Search, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConsoleStore } from "@/stores/console.store";

const consoleStore = useConsoleStore();

const searchQuery = ref("");

onMounted(() => {
  void consoleStore.initialize();
});

const filteredEntries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return consoleStore.exceptions;
  }

  return consoleStore.exceptions.filter((entry) =>
    `${entry.message} ${entry.source} ${entry.stack.join(" ")}`.toLowerCase().includes(query),
  );
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-surface-0">
    <div class="border-b border-border/30 bg-surface-2">
      <div class="flex h-11 items-center gap-2 px-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">Exceptions</div>
          <div class="text-[11px] text-muted-foreground/60">
            {{ consoleStore.activeTargetLabel }} · {{ filteredEntries.length }} visible ·
            {{ consoleStore.exceptions.length }} total
          </div>
        </div>
        <Badge
          variant="outline"
          class="h-6 rounded-full border border-error/30 bg-error/10 px-2 font-mono text-[10px] text-error"
        >
          {{ consoleStore.exceptions.length }} faults
        </Badge>
        <Button variant="ghost" size="sm" class="h-7 w-7" @click="consoleStore.clearExceptions()">
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>

      <div class="flex h-10 items-center gap-2 border-t border-border/20 px-3">
        <div
          class="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border/30 bg-surface-3 px-2"
        >
          <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
          <Input
            v-model="searchQuery"
            class="h-7 border-0 bg-transparent px-0 font-mono text-xs focus-visible:ring-0"
            placeholder="Filter exceptions…"
          />
        </div>
      </div>
    </div>

    <div
      v-if="!consoleStore.boundTargetId"
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground/45"
    >
      Connect target first to capture runtime exceptions.
    </div>

    <div
      v-else-if="filteredEntries.length === 0"
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground/45"
    >
      No exceptions captured yet.
    </div>

    <ScrollArea v-else class="min-h-0 flex-1">
      <div class="space-y-2 p-3">
        <section
          v-for="entry in filteredEntries"
          :key="entry.id"
          class="rounded-xl border border-error/20 bg-error/6 p-3"
        >
          <div class="flex items-start gap-2">
            <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-foreground">{{ entry.message }}</span>
                <span class="font-mono text-[10px] text-muted-foreground/60">{{
                  entry.timestampLabel
                }}</span>
              </div>
              <div class="mt-1 text-[11px] text-muted-foreground/70">
                {{ entry.source }}
                <span v-if="entry.url" class="font-mono"> · {{ entry.url }}</span>
              </div>
              <pre
                v-if="entry.stack.length"
                class="mt-3 overflow-x-auto rounded-lg border border-border/20 bg-surface-3 p-3 font-mono text-[11px] leading-5 text-foreground/80"
                >{{ entry.stack.join("\n") }}</pre
              >
            </div>
          </div>
        </section>
      </div>
    </ScrollArea>
  </div>
</template>
