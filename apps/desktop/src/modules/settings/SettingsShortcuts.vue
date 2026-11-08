<script setup lang="ts">
import { computed } from "vue";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { useBindingHint } from "@/composables/useBindingHint";
import { bindingTokens } from "@/lib/commands/keymap";
import { useCommandsStore } from "@/stores/commands.store";
import SettingsCard from "./components/SettingsCard.vue";
import SettingsPage from "./components/SettingsPage.vue";
import SettingsRow from "./components/SettingsRow.vue";

const commands = useCommandsStore();
const { labelOf } = useBindingHint();

const paletteDescription = computed(() => {
  const opener = labelOf("view.palette");
  const lead = opener ? `${opener} opens it; start` : "Start";
  return `${lead} with "open " for apps, > for actions, @ for devices and targets, # for tables and stores, or : for this screen.`;
});

const bound = computed(() => {
  const groups = new Map<string, Array<{ id: string; title: string; keys: string }>>();
  for (const command of commands.commands) {
    if (!command.binding) continue;
    const list = groups.get(command.group) ?? [];
    list.push({ id: command.id, title: command.title, keys: bindingTokens(command.binding) });
    groups.set(command.group, list);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
});

const DRAWER_SHORTCUTS = [
  { keys: "alt 1–2", action: "Switch between Logs and Console" },
  { keys: "cmd up", action: "Make the drawer taller" },
  { keys: "cmd down", action: "Make the drawer shorter" },
  { keys: "esc", action: "Clear the filter, then return focus to the page" },
] as const;
</script>

<template>
  <SettingsPage
    title="Shortcuts"
    description="Read from the command list, so every key shown here works."
  >
    <SettingsCard v-for="entry in bound" :key="entry.group" :title="entry.group">
      <SettingsRow v-for="item in entry.items" :key="item.id" :label="item.title">
        <KeyCaps :keys="item.keys" />
      </SettingsRow>
    </SettingsCard>

    <SettingsCard title="In the console drawer" description="While the drawer has focus.">
      <SettingsRow v-for="item in DRAWER_SHORTCUTS" :key="item.action" :label="item.action">
        <KeyCaps :keys="item.keys" />
      </SettingsRow>
    </SettingsCard>

    <SettingsCard title="Command palette" :description="paletteDescription">
      <SettingsRow label="Move through results">
        <KeyCaps keys="up down" />
      </SettingsRow>
      <SettingsRow label="Run the highlighted command">
        <KeyCaps keys="enter" />
      </SettingsRow>
    </SettingsCard>
  </SettingsPage>
</template>
