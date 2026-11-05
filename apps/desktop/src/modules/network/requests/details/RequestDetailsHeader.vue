<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, X } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { NetworkEntry } from "@/types/network.types";
import { TONE_CLASS, statusCell } from "../requestCells";
import { requestNameParts } from "../requestNames";
import { mockAvailability } from "../../mock/mockFromRequest";
import { hasResponseBody } from "./useRequestBodies";
import type { CopyKind } from "./useRequestActions";

const props = defineProps<{ entry: NetworkEntry; busy: boolean; canMock: boolean }>();

const emit = defineEmits<{ copy: [kind: CopyKind]; mock: []; close: [] }>();

const status = computed(() => statusCell(props.entry));
const name = computed(() => requestNameParts(props.entry.url));
const method = computed(() => {
  const value = props.entry.method.toUpperCase();
  return value === "GET" || props.entry.isWebSocket ? null : value;
});
const finished = computed(() => hasResponseBody(props.entry));
const mockable = computed(() => mockAvailability(props.entry));
const mockHint = computed(() =>
  mockable.value.ok ? "Creates a mock rule that answers like this response" : mockable.value.reason,
);
</script>

<template>
  <div class="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle pr-2 pl-4">
    <div class="flex min-w-0 flex-1 flex-col">
      <p class="flex min-w-0 items-baseline gap-2 text-xs">
        <span v-if="method" class="shrink-0 font-mono text-2xs text-[var(--fg-subtle)]">{{
          method
        }}</span>
        <HintTooltip :text="props.entry.url">
          <span class="truncate font-mono text-foreground">{{ name.main }}</span>
        </HintTooltip>
        <span class="shrink-0 font-mono tabular-nums" :class="TONE_CLASS[status.tone]">
          {{ status.text }}
        </span>
      </p>
      <p v-if="name.detail" class="truncate font-mono text-2xs text-[var(--fg-subtle)]">
        {{ name.detail }}
      </p>
    </div>
    <HintTooltip v-if="props.canMock" :text="mockHint">
      <Button
        size="sm"
        variant="transparent"
        :aria-disabled="!mockable.ok || undefined"
        :disabled="props.busy"
        class="shrink-0"
        :class="!mockable.ok && 'text-[var(--fg-subtle)]'"
        @click="mockable.ok && emit('mock')"
      >
        Mock this response
      </Button>
    </HintTooltip>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          size="sm"
          variant="transparent"
          :disabled="props.busy"
          content-class-name="gap-1"
          class="shrink-0"
        >
          Copy
          <ChevronDown :size="12" :stroke-width="1.8" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-48">
        <DropdownMenuItem @select="emit('copy', 'url')">Copy address</DropdownMenuItem>
        <DropdownMenuItem @select="emit('copy', 'curl')">Copy as cURL</DropdownMenuItem>
        <DropdownMenuItem @select="emit('copy', 'fetch')">Copy as fetch</DropdownMenuItem>
        <DropdownMenuItem :disabled="!finished" @select="emit('copy', 'response')">
          Copy response
        </DropdownMenuItem>
        <DropdownMenuItem :disabled="!finished" @select="emit('copy', 'base64')">
          Copy response as Base64
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <IconAction label="Close details" keys="Escape" size="sm" @click="emit('close')">
      <X :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
