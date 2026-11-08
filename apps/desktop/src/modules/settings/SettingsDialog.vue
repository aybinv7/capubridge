<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Dialog } from "@capubridge/cladd";
import { useMcpStore } from "@/stores/mcp.store";
import { useUpdaterStore } from "@/stores/updater.store";
import SettingsNav from "./SettingsNav.vue";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./settingsSections";
import { useSettingsClose } from "./useSettingsClose";

const route = useRoute();
const router = useRouter();
const updater = useUpdaterStore();
const mcp = useMcpStore();
const { close } = useSettingsClose();

onMounted(() => {
  void mcp.refresh();
});

const open = computed({
  get: () => route.path.startsWith("/settings"),
  set: (value: boolean) => {
    if (!value) void close();
  },
});

const current = computed<SettingsSectionId | null>(
  () => SETTINGS_SECTIONS.find((section) => section.routeName === route.name)?.id ?? null,
);

function select(path: string) {
  if (route.path !== path) void router.replace(path);
}
</script>

<template>
  <Dialog
    v-model:open="open"
    aria-label="Settings"
    data-overlay
    class="h-[640px] max-h-[calc(100vh-96px)] w-[920px] max-w-[calc(100vw-48px)]"
    content-class-name="flex h-full flex-row gap-0 overflow-hidden p-0"
  >
    <SettingsNav
      class="w-52 shrink-0 border-r border-border-subtle"
      :current="current"
      :update-available="updater.updateAvailable"
      :mcp-running="mcp.running"
      @select="select"
    />
    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
      <RouterView />
    </div>
  </Dialog>
</template>
