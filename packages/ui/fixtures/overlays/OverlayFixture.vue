<script setup lang="ts">
import { ref } from "vue";

import { Button, Dialog, Popover, Tooltip, UiProvider } from "../../src/index.ts";

const dialogOpen = ref(false);
const guardedDialogOpen = ref(false);
const nestedPopoverOpen = ref(false);
const popoverOpen = ref(false);
const tooltipOpen = ref(true);
const closedCount = ref(0);
</script>

<template>
  <UiProvider accent="brand" theme="dark">
    <Dialog
      v-model="dialogOpen"
      description="Dialog description"
      title="Dialog title"
      @closed="closedCount += 1"
    >
      <template #trigger>
        <Button data-testid="dialog-trigger">Open dialog</Button>
      </template>
      <template #default="{ close: closeDialog }">
        <Popover v-model="nestedPopoverOpen">
          <template #trigger>
            <Button data-testid="nested-trigger">Open nested</Button>
          </template>
          <template #default="{ close: closeNested }">
            <Button data-testid="nested-action">Nested action</Button>
            <Button data-testid="close-nested" @click="closeNested">Close nested</Button>
          </template>
        </Popover>
        <Button data-testid="close-dialog" @click="closeDialog">Close dialog</Button>
      </template>
    </Dialog>

    <Dialog
      v-model="guardedDialogOpen"
      confirm-text="Delete"
      description="This action cannot be undone."
      require-confirm-text="target"
      title="Delete target?"
    >
      <template #trigger>
        <Button data-testid="guarded-dialog-trigger">Open guarded dialog</Button>
      </template>
    </Dialog>

    <Popover v-model="popoverOpen" position="right-end">
      <template #trigger>
        <Button data-testid="popover-trigger">Open popover</Button>
      </template>
      <template #default="{ close: closePopover }">
        <span data-testid="popover-content">Popover content</span>
        <Button data-testid="close-popover" @click="closePopover">Close popover</Button>
      </template>
    </Popover>

    <Tooltip v-model="tooltipOpen" :delay="0">
      <template #trigger>
        <Button data-testid="tooltip-trigger">Tooltip trigger</Button>
      </template>
      Tooltip content
    </Tooltip>

    <output data-testid="closed-count">{{ closedCount }}</output>
  </UiProvider>
</template>
