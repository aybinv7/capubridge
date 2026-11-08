<script setup lang="ts">
import { Segmented, SegmentedButton, Switch } from "@capubridge/cladd";
import { useTheme } from "@/composables/useTheme";
import { useTimelineStripStore, type StripEdge } from "@/stores/timelineStrip.store";
import { useUIStore } from "@/stores/ui.store";
import SettingsCard from "./components/SettingsCard.vue";
import SettingsPage from "./components/SettingsPage.vue";
import SettingsRow from "./components/SettingsRow.vue";
import ThemeCard from "./components/ThemeCard.vue";

const { themeId, availableThemes, setTheme } = useTheme();
const strip = useTimelineStripStore();
const ui = useUIStore();

const EDGES: readonly { value: StripEdge; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];

function setRailShown(shown: boolean) {
  if (shown === ui.railHidden) ui.toggleRail();
}
</script>

<template>
  <SettingsPage title="Appearance" description="How Capubridge looks on this computer.">
    <SettingsCard
      title="Theme"
      description="Each signal keeps one colour: live, recording, selection and marks."
      padded
    >
      <div class="@container">
        <div class="grid grid-cols-2 gap-2.5 @md:grid-cols-3">
          <ThemeCard
            v-for="theme in availableThemes"
            :key="theme.id"
            :theme="theme"
            :active="themeId === theme.id"
            @select="setTheme"
          />
        </div>
      </div>
    </SettingsCard>

    <SettingsCard title="Timeline">
      <SettingsRow label="Show the timeline" description="Ctrl+Shift+J also hides and shows it.">
        <Switch
          :model-value="!strip.hidden"
          aria-label="Show the timeline"
          @update:model-value="strip.setHidden(!$event)"
        />
      </SettingsRow>
      <SettingsRow label="Position" description="Its own card, above or below the page.">
        <Segmented size="xs" aria-label="Where the timeline sits">
          <SegmentedButton
            v-for="option in EDGES"
            :key="option.value"
            :active="strip.edge === option.value"
            @click="strip.setEdge(option.value)"
          >
            {{ option.label }}
          </SegmentedButton>
        </Segmented>
      </SettingsRow>
    </SettingsCard>

    <SettingsCard title="Window">
      <SettingsRow
        label="Show the navigation rail"
        description="Ctrl+B also hides it; hover the left edge to reveal it while hidden."
      >
        <Switch
          :model-value="!ui.railHidden"
          aria-label="Show the navigation rail"
          @update:model-value="setRailShown"
        />
      </SettingsRow>
    </SettingsCard>
  </SettingsPage>
</template>
