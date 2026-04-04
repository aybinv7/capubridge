<script setup lang="ts">
import { CheckCircle, Clock, GitBranch, Play } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

const migrations = [
  {
    id: "M001",
    name: "init_schema",
    db: "appDatabase",
    version: 1,
    status: "applied",
    ts: "2024-01-15",
    duration: "12ms",
  },
  {
    id: "M002",
    name: "add_sync_queue",
    db: "appDatabase",
    version: 2,
    status: "applied",
    ts: "2024-02-01",
    duration: "8ms",
  },
  {
    id: "M003",
    name: "add_offline_cache",
    db: "appDatabase",
    version: 3,
    status: "applied",
    ts: "2024-03-01",
    duration: "45ms",
  },
  {
    id: "M004",
    name: "add_user_preferences",
    db: "jeep-sqlite",
    version: 1,
    status: "applied",
    ts: "2024-03-10",
    duration: "5ms",
  },
  {
    id: "M005",
    name: "add_metadata_index",
    db: "appDatabase",
    version: 4,
    status: "pending",
    ts: "—",
    duration: "—",
  },
  {
    id: "M006",
    name: "normalize_timestamps",
    db: "appDatabase",
    version: 5,
    status: "pending",
    ts: "—",
    duration: "—",
  },
];
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div class="max-w-xl">
      <div class="flex items-center justify-between mb-4">
        <div class="text-xs text-muted-foreground">
          {{ migrations.filter((m) => m.status === "applied").length }} applied ·
          {{ migrations.filter((m) => m.status === "pending").length }} pending
        </div>
        <Button
          variant="outline"
          size="sm"
          class="gap-1.5 bg-secondary text-foreground border-border hover:bg-secondary"
        >
          <Play class="w-3 h-3" />
          Run pending
        </Button>
      </div>

      <div class="relative">
        <div class="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
        <div v-for="(m, i) in migrations" :key="m.id" class="relative flex gap-4 pb-4 last:pb-0">
          <div class="relative z-10 shrink-0">
            <div
              class="w-[38px] h-[38px] rounded-lg border flex items-center justify-center"
              :class="
                m.status === 'applied'
                  ? 'bg-success/10 border-success/20'
                  : 'bg-secondary border-border'
              "
            >
              <CheckCircle v-if="m.status === 'applied'" class="w-4 h-4 text-success" />
              <Clock v-else class="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div
            class="flex-1 border p-3 mb-0"
            :class="m.status === 'applied' ? 'border-border bg-accent' : 'border-border bg-accent'"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="font-mono text-2xs text-muted-foreground">{{ m.id }}</span>
              <GitBranch class="w-2.5 h-2.5 text-muted-foreground" />
              <span class="text-xs font-medium text-foreground">{{ m.name }}</span>
            </div>
            <div class="flex items-center gap-3 text-2xs text-muted-foreground">
              <span class="font-mono">{{ m.db }}</span>
              <span>v{{ m.version }}</span>
              <span v-if="m.status === 'applied'" class="text-muted-foreground">{{ m.ts }}</span>
              <span v-if="m.duration !== '—'" class="font-mono">{{ m.duration }}</span>
              <span
                class="ml-auto font-medium"
                :class="m.status === 'applied' ? 'text-success' : 'text-muted-foreground'"
              >
                {{ m.status }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
