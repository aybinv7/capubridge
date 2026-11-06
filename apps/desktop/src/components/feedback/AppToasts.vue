<script setup lang="ts">
import { Toast } from "@capubridge/cladd";
import { forgetToast, setToastOpen, toastEntries } from "@/lib/toast";

/** Draws the app's toasts with Cladd's Toast, its stacking and its motion. Mount once per window. */
</script>

<template>
  <Toast
    v-for="entry in toastEntries"
    :key="entry.key"
    :close-button="entry.closeButton"
    :color="entry.color"
    :icon="entry.icon"
    :icon-props="entry.iconProps"
    :open="entry.open"
    :text="entry.text"
    :timeout="entry.timeout"
    :title="entry.title"
    @closed="forgetToast(entry.key)"
    @update:open="(open?: boolean) => setToastOpen(entry.key, open ?? false)"
  />
</template>
