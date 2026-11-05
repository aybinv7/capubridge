<script setup lang="ts">
import { computed } from "vue";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { NetworkEntry } from "@/types/network.types";
import { mockAvailability } from "../mock/mockFromRequest";
import { hasResponseBody } from "./details/useRequestBodies";
import type { CopyKind } from "./details/useRequestActions";

const props = defineProps<{ entry: NetworkEntry; canMock: boolean }>();

const emit = defineEmits<{ copy: [kind: CopyKind]; mock: [] }>();

const finished = computed(() => hasResponseBody(props.entry));
const mockable = computed(() => mockAvailability(props.entry));
</script>

<template>
  <ContextMenuContent class="w-60">
    <ContextMenuItem @select="emit('copy', 'url')">Copy address</ContextMenuItem>
    <ContextMenuItem @select="emit('copy', 'curl')">Copy as cURL</ContextMenuItem>
    <ContextMenuItem @select="emit('copy', 'fetch')">Copy as fetch</ContextMenuItem>
    <ContextMenuItem :disabled="!finished" @select="emit('copy', 'response')">
      Copy response
    </ContextMenuItem>
    <ContextMenuItem :disabled="!finished" @select="emit('copy', 'base64')">
      Copy response as Base64
    </ContextMenuItem>
    <template v-if="props.canMock">
      <ContextMenuSeparator />
      <ContextMenuItem
        :disabled="!mockable.ok"
        class="flex-col items-start gap-0.5"
        @select="emit('mock')"
      >
        Mock this response
        <span v-if="!mockable.ok" class="text-2xs whitespace-normal text-muted-foreground">
          {{ mockable.reason }}
        </span>
      </ContextMenuItem>
    </template>
  </ContextMenuContent>
</template>
