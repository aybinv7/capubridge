<script setup lang="ts">
import {
  Button,
  Chip,
  Shortcut,
  Spinner,
  Surface,
  CladdProvider,
  type ButtonSize,
} from '../../src/index.ts';

const sizes: ButtonSize[] = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'];
</script>

<template>
  <CladdProvider accent-color="brand" theme="dark">
    <div class="cladd-action-fixture dark">
      <Surface
        class="cladd-action-fixture__panel"
        :level="1"
        variant="gradient"
        outline
      >
        <Surface
          v-for="(size, index) in sizes"
          :key="size"
          class="cladd-action-fixture__row"
          :level="Math.min(index + 1, 5)"
        >
          <span class="cladd-action-fixture__label">{{ size }}</span>
          <Button :size="size">Save</Button>
          <Button color="green" :size="size" variant="gradient-fill"
            >Publish</Button
          >
          <Button aria-label="Refresh" :size="size" square>
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 4a8 8 0 1 0 7.4 5h-2.2A6 6 0 1 1 12 6v3l5-4-5-4v3Z"
              />
            </svg>
          </Button>
          <Chip color="cyan" :size="size">Connected</Chip>
          <Shortcut :size="size">ctrl k</Shortcut>
          <Spinner :size="size" />
        </Surface>
        <Surface class="cladd-action-fixture__row" :level="5">
          <Button disabled>Disabled</Button>
          <Button loading>Saving</Button>
          <Button rounded>Rounded</Button>
          <Button surface="cut">Recessed</Button>
        </Surface>
      </Surface>
    </div>
  </CladdProvider>
</template>

<style scoped>
.cladd-action-fixture {
  padding: 24px;
  background: var(--cladd-background);
  font-family: Inter, sans-serif;
}

.cladd-action-fixture__panel {
  overflow: hidden;
  border-radius: 18px;
}

.cladd-action-fixture__panel > :deep(.cladd-surface__content) {
  flex-direction: column;
  gap: 1px;
  height: auto;
  padding: 8px;
}

.cladd-action-fixture__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 8px 10px;
}

.cladd-action-fixture__label {
  width: 28px;
  color: var(--cladd-foreground-softer);
  font-family: ui-monospace, monospace;
  font-size: 10px;
}
</style>
