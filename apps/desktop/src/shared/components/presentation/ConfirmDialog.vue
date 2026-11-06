<script setup lang="ts">
import { computed } from "vue";
import { Dialog } from "@capubridge/cladd";
import {
  CONFIRM_DETAILS_SHOWN,
  type ConfirmRequest,
} from "@/shared/components/presentation/confirm";

const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{
  request: ConfirmRequest | null;
}>();

const emit = defineEmits<{ confirm: [] }>();

const details = computed(() => props.request?.details ?? []);
const shown = computed(() => details.value.slice(0, CONFIRM_DETAILS_SHOWN));
const more = computed(() => details.value.length - shown.value.length);
</script>

<template>
  <Dialog
    v-model:open="open"
    data-overlay
    :title="props.request?.title"
    :text="props.request?.text"
    :confirm-button-text="props.request?.confirmLabel"
    cancel-button-text="Cancel"
    :confirm-button-color="props.request?.danger ? 'red' : 'brand'"
    :require-confirm-text="props.request?.requireConfirmText"
    :class="
      details.length ? 'w-[560px] max-w-[calc(100vw-48px)]' : 'w-[400px] max-w-[calc(100vw-48px)]'
    "
    @confirm="emit('confirm')"
  >
    <ul
      v-if="details.length"
      class="max-h-56 overflow-auto rounded-inner bg-surface-cut px-3 py-2 font-mono text-2xs text-muted-foreground shadow-cut select-text"
      aria-label="Details"
    >
      <li v-for="(line, index) in shown" :key="index" class="py-0.5 break-words">{{ line }}</li>
      <li v-if="more > 0" class="py-0.5 text-[var(--fg-subtle)]">
        and {{ more.toLocaleString("en-US") }} more
      </li>
    </ul>
  </Dialog>
</template>
