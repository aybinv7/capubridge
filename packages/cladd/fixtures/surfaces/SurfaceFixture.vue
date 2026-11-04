<script setup lang="ts">
import { Surface, SurfaceCut, CladdProvider } from '../../src/index.ts';

const themes: ('dark' | 'light')[] = ['dark', 'light'];
</script>

<template>
  <div class="cladd-fixture-grid">
    <!-- The theme cascade lives on the app's own element (`dark`/`light` + `cladd-color-*`), like a
         Cladd app; `CladdProvider` only publishes context. -->
    <div
      v-for="theme in themes"
      :key="theme"
      class="cladd-fixture-shell cladd-color-cyan"
      :class="theme"
    >
      <CladdProvider accent-color="cyan" :theme="theme">
        <Surface
          class="cladd-fixture-panel"
          :level="1"
          variant="gradient"
          outline
        >
          <div class="cladd-fixture-heading">
            <span>Device workspace</span>
            <span class="cladd-fixture-meta">{{ theme }}</span>
          </div>
          <Surface class="cladd-fixture-row" hoverable>
            <span>Pixel 9 Pro</span>
            <span class="cladd-fixture-status">connected</span>
          </Surface>
          <Surface variant="transparent" class="cladd-fixture-group">
            <Surface class="cladd-fixture-inspector" color="purple" outline>
              <span>Storage inspector</span>
              <SurfaceCut class="cladd-fixture-cut"
                >IndexedDB / 14 stores</SurfaceCut
              >
            </Surface>
          </Surface>
        </Surface>
      </CladdProvider>
    </div>
  </div>
</template>

<style scoped>
.cladd-fixture-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  font-family: Inter, sans-serif;
}

.cladd-fixture-shell {
  padding: 24px;
  background: var(--cladd-bg);
}

.cladd-fixture-panel {
  overflow: hidden;
  border-radius: 18px;
}

.cladd-fixture-panel > :deep(.cladd-surface__content) {
  flex-direction: column;
  gap: 1px;
  padding: 6px;
}

.cladd-fixture-heading,
.cladd-fixture-row,
.cladd-fixture-inspector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.cladd-fixture-heading {
  color: var(--cladd-fg-soft);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cladd-fixture-meta,
.cladd-fixture-status {
  color: var(--cladd-fg-softer);
  font-size: 10px;
}

.cladd-fixture-row,
.cladd-fixture-inspector,
.cladd-fixture-cut {
  border-radius: 10px;
}

.cladd-fixture-group > :deep(.cladd-surface__content) {
  display: block;
  padding-top: 5px;
}

.cladd-fixture-inspector {
  gap: 10px;
}

.cladd-fixture-inspector > :deep(.cladd-surface__content) {
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

.cladd-fixture-cut {
  padding: 4px 8px;
  color: var(--cladd-fg-soft);
  font-size: 10px;
}
</style>
