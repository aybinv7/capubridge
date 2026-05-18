<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHROME_CDP_PORT } from "@/config/ports";
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";

const customChromePath = ref("");
const chromePort = ref(CHROME_CDP_PORT);
const customArgs = ref("");
const launchMode = ref<"auto" | "manual">("auto");
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection title="Chrome" description="How Capubridge launches and connects to Chrome.">
      <SettingsRow label="CDP port" description="Port Chrome exposes for debugging">
        <Input
          v-model.number="chromePort"
          type="number"
          class="h-8 w-24 text-center font-mono text-xs"
          :min="1024"
          :max="65535"
        />
      </SettingsRow>

      <SettingsRow
        label="Chrome path"
        description="Custom Chrome executable (leave empty for auto-detect)"
      >
        <Input
          v-model="customChromePath"
          class="h-8 w-56 font-mono text-xs"
          placeholder="auto-detect"
        />
      </SettingsRow>

      <SettingsRow
        label="Extra launch args"
        description="Additional flags passed when launching Chrome"
      >
        <Input
          v-model="customArgs"
          class="h-8 w-72 font-mono text-xs"
          placeholder="--disable-extensions --disable-gpu"
        />
      </SettingsRow>

      <SettingsRow
        label="Launch mode"
        description="Auto-launch starts a new Chrome instance; manual connect attaches to one started with --remote-debugging-port"
      >
        <div class="flex gap-1.5">
          <Button
            :variant="launchMode === 'auto' ? 'default' : 'outline'"
            size="sm"
            @click="launchMode = 'auto'"
          >
            Auto-launch
          </Button>
          <Button
            :variant="launchMode === 'manual' ? 'default' : 'outline'"
            size="sm"
            @click="launchMode = 'manual'"
          >
            Manual connect
          </Button>
        </div>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
