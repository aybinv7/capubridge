<script setup lang="ts">
import Dialog from './Dialog.vue';
import { useDialogsPortalContext } from './dialogsPortalContext.ts';

const { data, state } = useDialogsPortalContext();

function onClosed(): void {
  const current = data.value;
  data.value = null;
  current?.onClosed?.(false);
}
</script>

<template>
  <Dialog
    v-if="data"
    v-model:open="state"
    :cancel-button-color="data.cancelButtonColor"
    :cancel-button-text="data.cancelButtonText"
    :confirm-button-color="data.confirmButtonColor"
    :confirm-button-text="data.confirmButtonText"
    :lazy="data.lazy"
    :stop-propagation-on-click="data.stopPropagationOnClick"
    :text="data.text"
    :require-confirm-text="
      data.requireConfirmText ? String(data.requireConfirmText) : undefined
    "
    :title="data.title"
    @cancel="data.onCancel?.(false)"
    @closed="onClosed"
    @confirm="data.onConfirm?.(true)"
  />
</template>
