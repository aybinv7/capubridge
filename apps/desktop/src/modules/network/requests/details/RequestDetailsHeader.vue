<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, Maximize2, Minimize2, X } from "lucide-vue-next";
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
import { TONE_CLASS } from "../requestCells";
import { mockAvailability } from "../../mock/mockFromRequest";
import { headerFacts } from "./requestFacts";
import { hasResponseBody } from "./useRequestBodies";
import type { CopyKind } from "./useRequestActions";

const props = defineProps<{
  entry: NetworkEntry;
  busy: boolean;
  canMock: boolean;
  maximized: boolean;
}>();

const emit = defineEmits<{
  copy: [kind: CopyKind];
  mock: [];
  close: [];
  maximize: [maximized: boolean];
}>();

const facts = computed(() => headerFacts(props.entry));
const finished = computed(() => hasResponseBody(props.entry));
const mockable = computed(() => mockAvailability(props.entry));
const mockHint = computed(() =>
  mockable.value.ok ? "Creates a mock rule that answers like this response" : mockable.value.reason,
);
</script>

<template>
  <header class="flex shrink-0 items-start gap-2 border-b border-border-subtle py-2.5 pr-2 pl-4">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p class="flex h-7 min-w-0 items-center gap-2 font-mono text-sm">
        <span v-if="facts.method" class="shrink-0 text-xs text-[var(--fg-subtle)]">{{
          facts.method
        }}</span>
        <span class="truncate font-medium text-foreground">{{ facts.name }}</span>
        <span class="shrink-0 text-xs tabular-nums" :class="TONE_CLASS[facts.status.tone]">
          {{ facts.status.text }}
        </span>
      </p>
      <HintTooltip :text="facts.address">
        <p class="truncate font-mono text-2xs text-[var(--fg-subtle)] select-text">
          {{ facts.address }}
        </p>
      </HintTooltip>
    </div>
    <div class="flex h-7 shrink-0 items-center gap-1">
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
      <IconAction
        :label="
          props.maximized
            ? 'Put the details back beside the list'
            : 'Fill the screen with the details'
        "
        size="sm"
        toggle
        :pressed="props.maximized"
        @click="emit('maximize', !props.maximized)"
      >
        <Minimize2 v-if="props.maximized" :stroke-width="1.8" />
        <Maximize2 v-else :stroke-width="1.8" />
      </IconAction>
      <IconAction label="Close details" keys="Escape" size="sm" @click="emit('close')">
        <X :stroke-width="1.8" />
      </IconAction>
    </div>
  </header>
</template>
