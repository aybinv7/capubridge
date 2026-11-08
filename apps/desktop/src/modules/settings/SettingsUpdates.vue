<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { CircleAlert, CircleCheck } from "lucide-vue-next";
import { Button, Switch } from "@capubridge/cladd";
import { toast } from "@/lib/toast";
import { useUpdaterStore } from "@/stores/updater.store";
import SettingsCard from "./components/SettingsCard.vue";
import SettingsPage from "./components/SettingsPage.vue";
import SettingsRow from "./components/SettingsRow.vue";
import UpdateAvailableCard from "./updates/UpdateAvailableCard.vue";

const updater = useUpdaterStore();
const appVersion = ref("");

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

onMounted(async () => {
  try {
    appVersion.value = await getVersion();
  } catch {
    appVersion.value = updater.info?.currentVersion ?? "";
  }
});

const lastChecked = computed(() =>
  updater.lastChecked ? `Last checked ${dateFormat.format(updater.lastChecked)}` : "Never checked",
);

async function checkNow() {
  try {
    await updater.check();
    if (updater.status === "up-to-date") toast.success("You have the latest version");
  } catch (error) {
    toast.error("Could not check for updates", { description: String(error) });
  }
}

async function setPrerelease(value: boolean) {
  updater.setPrerelease(value);
  await checkNow();
}

async function install() {
  await updater.install();
  if (updater.status === "error" && updater.error) {
    toast.error("The update failed", { description: updater.error });
  }
}
</script>

<template>
  <SettingsPage title="Updates">
    <template #aside>
      <span class="font-mono text-2xs text-muted-foreground tabular-nums">
        {{ appVersion ? `v${appVersion}` : "Version unknown" }}
      </span>
    </template>

    <SettingsCard>
      <SettingsRow label="Check for updates" :description="lastChecked">
        <Button
          size="xs"
          variant="solid"
          :loading="updater.status === 'checking'"
          :disabled="updater.isBusy"
          @click="checkNow"
        >
          Check now
        </Button>
      </SettingsRow>
      <SettingsRow
        label="Pre-release versions"
        description="Get test builds before everyone else. They can be less stable."
      >
        <Switch
          :model-value="updater.prerelease"
          :disabled="updater.isBusy"
          aria-label="Pre-release versions"
          @update:model-value="setPrerelease"
        />
      </SettingsRow>
      <div
        v-if="updater.status === 'up-to-date'"
        class="flex items-center gap-2 px-3.5 py-2.5 text-2xs text-muted-foreground"
        role="status"
      >
        <CircleCheck :size="14" class="shrink-0 text-signal-live" aria-hidden="true" />
        You have the latest version.
      </div>
      <div
        v-else-if="updater.status === 'error'"
        class="flex items-start gap-2 px-3.5 py-2.5"
        role="alert"
      >
        <CircleAlert :size="14" class="mt-px shrink-0 text-destructive" aria-hidden="true" />
        <p class="min-w-0 flex-1 text-2xs break-words text-muted-foreground">
          <span class="text-foreground">The update check failed.</span> {{ updater.error }}
        </p>
        <Button size="xs" variant="solid" :disabled="updater.isBusy" @click="checkNow">
          Try again
        </Button>
      </div>
    </SettingsCard>

    <UpdateAvailableCard
      v-if="updater.updateAvailable || updater.status === 'downloading'"
      :version="updater.info?.version ?? null"
      :notes="updater.info?.notes ?? null"
      :downloading="updater.status === 'downloading'"
      :progress-pct="updater.progressPct"
      :busy="updater.isBusy"
      @install="install"
    />
  </SettingsPage>
</template>
