<script setup lang="ts">
import { Surface, SurfaceCut, UiProvider, type UiTheme } from "../../src/index.ts";

const themes: UiTheme[] = ["dark", "light"];
</script>

<template>
  <div class="cui-fixture-grid">
    <!-- The theme cascade lives on the app's own element (`dark`/`light` + `cui-color-*`), like a
         Cladd app; `UiProvider` only publishes context. -->
    <div
      v-for="theme in themes"
      :key="theme"
      class="cui-fixture-shell cui-color-cyan"
      :class="theme"
    >
      <UiProvider accent-color="cyan" :theme="theme">
        <Surface class="cui-fixture-panel" :level="1" variant="gradient" outline>
          <div class="cui-fixture-heading">
            <span>Device workspace</span>
            <span class="cui-fixture-meta">{{ theme }}</span>
          </div>
          <Surface class="cui-fixture-row" hoverable>
            <span>Pixel 9 Pro</span>
            <span class="cui-fixture-status">connected</span>
          </Surface>
          <Surface variant="transparent" class="cui-fixture-group">
            <Surface class="cui-fixture-inspector" accent="purple" outline>
              <span>Storage inspector</span>
              <SurfaceCut class="cui-fixture-cut">IndexedDB / 14 stores</SurfaceCut>
            </Surface>
          </Surface>
        </Surface>
      </UiProvider>
    </div>
  </div>
</template>

<style scoped>
.cui-fixture-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  font-family: Geist, sans-serif;
}

.cui-fixture-shell {
  padding: 24px;
  background: var(--cui-bg);
}

.cui-fixture-panel {
  overflow: hidden;
  border-radius: 18px;
}

.cui-fixture-panel > :deep(.cui-surface__content) {
  flex-direction: column;
  gap: 1px;
  padding: 6px;
}

.cui-fixture-heading,
.cui-fixture-row,
.cui-fixture-inspector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.cui-fixture-heading {
  color: var(--cui-fg-soft);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cui-fixture-meta,
.cui-fixture-status {
  color: var(--cui-fg-softer);
  font-size: 10px;
}

.cui-fixture-row,
.cui-fixture-inspector,
.cui-fixture-cut {
  border-radius: 10px;
}

.cui-fixture-group > :deep(.cui-surface__content) {
  display: block;
  padding-top: 5px;
}

.cui-fixture-inspector {
  gap: 10px;
}

.cui-fixture-inspector > :deep(.cui-surface__content) {
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

.cui-fixture-cut {
  padding: 4px 8px;
  color: var(--cui-fg-soft);
  font-size: 10px;
}
</style>
