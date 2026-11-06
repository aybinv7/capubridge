<script setup lang="ts">
import { Segmented, SegmentedButton, Switch } from "@capubridge/cladd";
import { useTheme } from "@/composables/useTheme";
import { useTimelineStripStore, type StripEdge } from "@/stores/timelineStrip.store";
import ThemeCard from "./components/ThemeCard.vue";
import SettingsRow from "./components/SettingsRow.vue";
import SettingsSection from "./components/SettingsSection.vue";

const { themeId, availableThemes, setTheme } = useTheme();
const strip = useTimelineStripStore();

const EDGES: readonly { value: StripEdge; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection
      title="Theme"
      description="Colour carries meaning: live, recording, selection and marks each own one hue."
    >
      <div class="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
        <ThemeCard
          v-for="theme in availableThemes"
          :key="theme.id"
          :theme="theme"
          :active="themeId === theme.id"
          @select="setTheme"
        />
      </div>
    </SettingsSection>

    <SettingsSection
      title="Timeline"
      description="The live strip of what happens on the device, shown on every screen."
    >
      <SettingsRow label="Show the timeline" description="Ctrl+Shift+J also hides and shows it.">
        <Switch
          :checked="!strip.hidden"
          aria-label="Show the timeline"
          @update:checked="strip.setHidden(!$event)"
        />
      </SettingsRow>
      <SettingsRow
        label="Position"
        description="At the top it sits under the title bar; at the bottom, under the console."
      >
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
    </SettingsSection>
  </div>
</template>
