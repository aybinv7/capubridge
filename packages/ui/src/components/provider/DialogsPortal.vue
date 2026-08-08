<script setup lang="ts">
import Dialog from "../overlays/Dialog.vue";
import { useDialogsPortalContext } from "./dialogsPortalContext.ts";

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
    :cancel-accent="data.cancelButtonColor"
    :cancel-text="data.cancelButtonText"
    :confirm-accent="data.confirmButtonColor"
    :confirm-text="data.confirmButtonText"
    :description="data.text"
    :require-confirm-text="data.requireConfirmText ? String(data.requireConfirmText) : undefined"
    :title="data.title"
    @cancel="data.onCancel?.(false)"
    @closed="onClosed"
    @confirm="data.onConfirm?.(true)"
  />
</template>
