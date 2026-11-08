<script setup lang="ts">
import { CHROME_CDP_PORT } from "@/config/ports";
import { useUIStore } from "@/stores/ui.store";
import SettingsCard from "./components/SettingsCard.vue";
import SettingsPage from "./components/SettingsPage.vue";
import SettingsRow from "./components/SettingsRow.vue";
import RememberedPhones from "./devices/RememberedPhones.vue";
import { useSettingsClose } from "./useSettingsClose";

const ui = useUIStore();
const { close } = useSettingsClose();

function connectOverWifi() {
  void close(() => ui.openDeviceManager("connect"));
}
</script>

<template>
  <SettingsPage title="Devices" description="How Capubridge reaches phones and browsers.">
    <RememberedPhones @connect="connectOverWifi" />

    <SettingsCard title="Android">
      <SettingsRow label="ADB">
        <template #description>
          Found when Capubridge starts: <code class="font-mono">CAPUBRIDGE_ADB_PATH</code>, then the
          bundled platform tools, then <code class="font-mono">adb</code> on the path.
        </template>
        <span class="text-2xs text-[var(--fg-subtle)]">Automatic</span>
      </SettingsRow>
      <SettingsRow
        label="Looking for devices"
        description="The device workspace decides how often to look; it cannot be set yet."
      >
        <span class="text-2xs text-[var(--fg-subtle)]">Automatic</span>
      </SettingsRow>
    </SettingsCard>

    <SettingsCard title="Chrome on this computer">
      <SettingsRow
        label="Chrome"
        description="A supported Chrome installed on this computer is found by itself."
      >
        <span class="text-2xs text-[var(--fg-subtle)]">Automatic</span>
      </SettingsRow>
      <SettingsRow
        label="Debugging port"
        description="Custom paths, launch flags and connection modes cannot be set yet."
      >
        <span class="font-mono text-2xs text-muted-foreground tabular-nums">{{
          CHROME_CDP_PORT
        }}</span>
      </SettingsRow>
    </SettingsCard>
  </SettingsPage>
</template>
