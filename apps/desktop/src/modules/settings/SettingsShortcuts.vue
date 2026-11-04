<script setup lang="ts">
import { computed } from "vue";
import { useCommandsStore } from "@/stores/commands.store";
import { bindingTokens } from "@/lib/commands/keymap";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { useBindingHint } from "@/composables/useBindingHint";
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";

const commands = useCommandsStore();
const { labelOf } = useBindingHint();

const paletteDescription = computed(() => {
  const opener = labelOf("view.palette");
  const lead = opener ? `${opener} opens it; start` : "Start";
  return `${lead} with > for commands, @ for devices and targets, or : for this screen.`;
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

const dockShortcuts = [
  { keys: "alt 1–9", action: "Switch dock tab" },
  { keys: "cmd up", action: "Grow the dock" },
  { keys: "cmd down", action: "Shrink the dock" },
  { keys: "esc", action: "Return focus to the main view" },
];
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection
      v-for="entry in bound"
      :key="entry.group"
      :title="entry.group"
      description="Generated from the command registry — every key listed here is wired."
    >
      <SettingsRow v-for="item in entry.items" :key="item.id" :label="item.title">
        <KeyCaps :keys="item.keys" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection title="In the console dock" description="Active while the dock has focus.">
      <SettingsRow v-for="item in dockShortcuts" :key="item.action" :label="item.action">
        <KeyCaps :keys="item.keys" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection title="Command palette" :description="paletteDescription">
      <SettingsRow label="Navigate results">
        <KeyCaps keys="up down" />
      </SettingsRow>
      <SettingsRow label="Run the highlighted command">
        <KeyCaps keys="enter" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
