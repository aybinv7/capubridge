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
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { NetworkEntry } from "@/types/network.types";
import { TONE_CLASS, requestHost, requestName, statusCell } from "../requestCells";
import { hasResponseBody } from "./useRequestBodies";
import type { CopyKind } from "./useRequestActions";

const props = defineProps<{ entry: NetworkEntry; busy: boolean; canMock: boolean }>();

const emit = defineEmits<{ copy: [kind: CopyKind]; mock: []; close: [] }>();

const status = computed(() => statusCell(props.entry));
const host = computed(() => requestHost(props.entry.url));
const finished = computed(() => hasResponseBody(props.entry));
</script>

<template>
  <div class="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle pr-2 pl-4">
    <div class="flex min-w-0 flex-1 flex-col">
      <p class="flex min-w-0 items-baseline gap-2 text-xs">
        <span class="shrink-0 font-mono text-2xs text-muted-foreground">{{
          props.entry.method
        }}</span>
        <span class="truncate font-mono text-foreground" :title="props.entry.url">
          {{ requestName(props.entry.url) }}
        </span>
        <span class="shrink-0 font-mono tabular-nums" :class="TONE_CLASS[status.tone]">
          {{ status.text }}
        </span>
      </p>
      <p v-if="host" class="truncate font-mono text-2xs text-[var(--fg-subtle)]">{{ host }}</p>
    </div>
    <Button
      v-if="props.canMock"
      size="sm"
      variant="transparent"
      :disabled="!finished || props.busy"
      :title="
        finished
          ? 'Create a mock rule that answers like this response'
          : 'Available once the request has finished'
      "
      class="shrink-0"
      @click="emit('mock')"
    >
      Mock this response
    </Button>
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
      </DropdownMenuContent>
    </DropdownMenu>
    <IconAction label="Close details" keys="Escape" size="sm" @click="emit('close')">
      <X :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
