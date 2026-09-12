<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { ExternalLink } from "lucide-vue-next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sqliteSourceDescriptor, sqliteSourceTech } from "./sqliteSources";
import type { SqliteDbFile } from "@/types/sqlite.types";

const props = defineProps<{ db: SqliteDbFile }>();

const router = useRouter();
const descriptor = computed(() => sqliteSourceDescriptor(props.db));
const tech = computed(() => sqliteSourceTech(props.db));

const opfsPath = computed(() => props.db.sourceOpfsPath ?? null);
const opfsDirectory = computed(() => props.db.sourceOpfsDirectory ?? null);

function exploreSource() {
  if (opfsDirectory.value === null) return;
  void router.push({ path: "/storage/opfs", query: { path: opfsDirectory.value } });
}
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          class="shrink-0 rounded border px-1.5 py-px text-[9px] font-mono uppercase tracking-wider"
          :class="descriptor.badgeClass"
        >
          {{ descriptor.label }}
        </span>
      </TooltipTrigger>
      <TooltipContent variant="surface" side="right" class="max-w-[280px] space-y-1.5 p-2.5">
        <p class="text-xs font-medium text-foreground">{{ descriptor.title }}</p>
        <p class="text-[11px] leading-relaxed text-muted-foreground">
          {{ descriptor.description }}
        </p>
        <p v-if="descriptor.packageName" class="font-mono text-[10px] text-muted-foreground/70">
          {{ descriptor.packageName }}
        </p>
        <p v-if="opfsPath" class="break-all font-mono text-[10px] text-muted-foreground/60">
          {{ opfsPath }}
        </p>
        <button
          v-if="opfsDirectory !== null"
          class="flex items-center gap-1 text-[10px] text-info hover:underline"
          @click="exploreSource"
        >
          <ExternalLink :size="10" />
          Show in OPFS explorer
        </button>
        <p
          v-else-if="tech === 'jeep-sqlite'"
          class="font-mono text-[10px] text-muted-foreground/60"
        >
          {{ db.sourceIdbName ?? "jeepSQLiteStore" }} / {{ db.sourceStoreName ?? "databases" }}
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
