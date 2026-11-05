<script setup lang="ts">
import { Dialog } from "@capubridge/cladd";
import type { DeviceConfirmRequest } from "./confirm";

const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{
  request: DeviceConfirmRequest | null;
}>();

const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <Dialog
    v-model:open="open"
    data-overlay
    :title="props.request?.title"
    :text="props.request?.text"
    :confirm-button-text="props.request?.confirmLabel"
    cancel-button-text="Cancel"
    :confirm-button-color="props.request?.danger ? 'red' : undefined"
    class="w-[400px] max-w-[calc(100vw-48px)]"
    @confirm="emit('confirm')"
  />
</template>
