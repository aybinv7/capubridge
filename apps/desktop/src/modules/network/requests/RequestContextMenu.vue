<script setup lang="ts">
import { computed } from "vue";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { NetworkEntry } from "@/types/network.types";
import { hasResponseBody } from "./details/useRequestBodies";
import type { CopyKind } from "./details/useRequestActions";

const props = defineProps<{ entry: NetworkEntry; canMock: boolean }>();

const emit = defineEmits<{ copy: [kind: CopyKind]; mock: [] }>();

const finished = computed(() => hasResponseBody(props.entry));
</script>

<template>
  <ContextMenuContent class="w-52">
    <ContextMenuItem @select="emit('copy', 'url')">Copy address</ContextMenuItem>
    <ContextMenuItem @select="emit('copy', 'curl')">Copy as cURL</ContextMenuItem>
    <ContextMenuItem @select="emit('copy', 'fetch')">Copy as fetch</ContextMenuItem>
    <ContextMenuItem :disabled="!finished" @select="emit('copy', 'response')">
      Copy response
    </ContextMenuItem>
    <template v-if="props.canMock">
      <ContextMenuSeparator />
      <ContextMenuItem :disabled="!finished" @select="emit('mock')">
        Mock this response
      </ContextMenuItem>
    </template>
  </ContextMenuContent>
</template>
