<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";

const adbPath = ref("");
const pollingInterval = ref("3s");
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection title="ADB" description="How Capubridge talks to your devices.">
      <SettingsRow label="ADB path" description="Path to the adb binary">
        <Input
          id="adb-path"
          v-model="adbPath"
          class="h-8 w-56 font-mono text-xs"
          placeholder="auto-detect"
        />
      </SettingsRow>

      <SettingsRow label="Polling interval" description="How often to refresh the device list">
        <div class="flex gap-1.5">
          <Button
            v-for="ms in ['1s', '3s', '5s', '10s']"
            :key="ms"
            :variant="pollingInterval === ms ? 'default' : 'outline'"
            size="sm"
            @click="pollingInterval = ms"
          >
            {{ ms }}
          </Button>
        </div>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
