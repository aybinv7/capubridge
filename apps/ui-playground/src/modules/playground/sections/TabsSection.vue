<script setup lang="ts">
import { Tab, TabPanel, Tabs, TabsList } from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundSegmented from "../components/PlaygroundSegmented.vue";
import PlaygroundSwitchControl from "../components/PlaygroundSwitchControl.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";

defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const tabValue = ref("overview");
const size = ref("md");
const rounded = ref(true);
const keepMounted = ref(false);
const sizes = ["sm", "md", "lg"] as const;

const code = computed(
  () => `<Tabs v-model:value="value">
  <TabsList size="${size.value}" ${rounded.value ? "" : ':rounded="false"'}>
    <Tab value="overview">Overview</Tab>
    <Tab value="activity">Activity</Tab>
    <Tab value="settings">Settings</Tab>
  </TabsList>
  <TabPanel value="overview" ${keepMounted.value ? "keep-mounted" : ""}>Overview content</TabPanel>
  <TabPanel value="activity" ${keepMounted.value ? "keep-mounted" : ""}>Activity content</TabPanel>
  <TabPanel value="settings" ${keepMounted.value ? "keep-mounted" : ""}>Settings content</TabPanel>
</Tabs>`,
);
</script>

<template>
  <CatalogSection
    description="A keyboard-navigable tablist built from Segmented/SegmentedButton, with panels that mount only the selected tab's content by default."
    eyebrow="07 · Navigation"
    id="tabs"
    title="Tabs"
  >
    <ComponentPlayground :code="code" preview-surface>
      <template #preview>
        <div class="tabs-section__preview">
          <Tabs v-model:value="tabValue">
            <TabsList :rounded="rounded" :size="size">
              <Tab value="overview">Overview</Tab>
              <Tab :disabled="!interactionsEnabled" value="activity">Activity</Tab>
              <Tab value="settings">Settings</Tab>
            </TabsList>
            <TabPanel :keep-mounted="keepMounted" class="tabs-section__panel" value="overview">
              Overview content
            </TabPanel>
            <TabPanel :keep-mounted="keepMounted" class="tabs-section__panel" value="activity">
              Activity content
            </TabPanel>
            <TabPanel :keep-mounted="keepMounted" class="tabs-section__panel" value="settings">
              Settings content
            </TabPanel>
          </Tabs>
        </div>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented v-model="size" :items="sizes" label="Tab size" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="rounded" label="rounded" />
          <PlaygroundSwitchControl v-model="keepMounted" label="keepMounted" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>

<style scoped>
.tabs-section__preview {
  width: 100%;
}

.tabs-section__panel {
  padding: 12px 4px;
}
</style>
