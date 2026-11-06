<script setup lang="ts">
import { Chip } from "@capubridge/cladd";
import type { StorageTechHint } from "@capubridge/cdp-protocol";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";

/**
 * What the folder's layout suggests stored it (SQLite WASM, wa-sqlite, a SAH-Pool…), as quiet
 * chips; each explains itself, its package and its evidence on hover.
 */
const props = defineProps<{ hints: readonly StorageTechHint[] }>();

const CONFIDENCE = { high: "Sure", medium: "Likely", low: "A guess" } as const;

function explain(hint: StorageTechHint): string {
  return [
    `${CONFIDENCE[hint.confidence]}: ${hint.description}`,
    hint.packageName ? `Package ${hint.packageName}.` : "",
    hint.evidence.length > 0 ? `Seen: ${hint.evidence.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
</script>

<template>
  <ul
    v-if="props.hints.length > 0"
    class="flex min-w-0 flex-wrap items-center gap-1"
    aria-label="Detected storage"
  >
    <li v-for="hint in props.hints" :key="`${hint.id}:${hint.label}`">
      <HintTooltip :text="explain(hint)">
        <Chip size="xs" tabindex="0">{{ hint.label }}</Chip>
      </HintTooltip>
    </li>
  </ul>
</template>
