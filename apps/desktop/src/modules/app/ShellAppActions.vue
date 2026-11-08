<script setup lang="ts">
import ConfirmDialog from "@/shared/components/presentation/ConfirmDialog.vue";
import { useShellAppCommands } from "./lifecycle/useShellAppCommands";

/**
 * Mounted once in the shell: registers the app-wide restart, force stop and clear data commands
 * and draws the question the destructive ones ask.
 */
const { confirmOpen, confirmRequest, confirm } = useShellAppCommands();
</script>

<template>
  <ConfirmDialog v-model:open="confirmOpen" :request="confirmRequest" @confirm="confirm()" />
</template>
