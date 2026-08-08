<script setup lang="ts">
import Toast from "../feedback/Toast.vue";
import { useToastsPortalContext, type ToastsPortalData } from "./toastsPortalContext.ts";

const { data, state } = useToastsPortalContext();

function setOpen(toast: ToastsPortalData, open: boolean): void {
  state.value = { ...state.value, [toast.id]: open };
}

function onClosed(toast: ToastsPortalData): void {
  if (toast.removed) return;
  toast.removed = true;
  data.value = data.value.filter((entry) => entry !== toast);
  toast.onClosed?.(false);
}
</script>

<template>
  <Toast
    v-for="toast in data"
    :key="toast.id"
    :class="toast.className"
    :close-button="toast.closeButton"
    :color="toast.color"
    :icon="toast.icon"
    :icon-props="toast.iconProps"
    :open="state[toast.id]"
    :text="toast.text"
    :timeout="toast.timeout"
    :title="toast.title"
    @closed="onClosed(toast)"
    @update:open="(open: boolean) => setOpen(toast, open)"
  />
</template>
