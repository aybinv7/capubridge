<script setup lang="ts">
import { Button, Chip, Shortcut } from "@capubridge/ui";
import type { UiTheme } from "@capubridge/ui";

defineProps<{
  componentCount: number;
  stateCount: number;
  theme: UiTheme;
}>();

const emit = defineEmits<{
  toggleTheme: [];
}>();
</script>

<template>
  <header class="playground-header">
    <div class="playground-header__brand">
      <span class="playground-header__mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <div>
        <strong>CapuBridge UI</strong>
        <span>Visual laboratory</span>
      </div>
    </div>
    <div class="playground-header__metrics">
      <Chip size="xs" variant="transparent">{{ componentCount }} components</Chip>
      <Chip size="xs" variant="transparent">{{ stateCount }} states</Chip>
    </div>
    <div class="playground-header__actions">
      <Shortcut size="xs">cmd k</Shortcut>
      <Button
        :label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`"
        rounded
        size="sm"
        square
        variant="transparent"
        @click="emit('toggleTheme')"
      >
        {{ theme === "dark" ? "☼" : "◐" }}
      </Button>
    </div>
  </header>
</template>
