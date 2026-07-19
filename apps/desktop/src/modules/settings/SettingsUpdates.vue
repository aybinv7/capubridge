<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { RefreshCw, Download, CheckCircle2, AlertCircle, RotateCw } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUpdaterStore } from "@/stores/updater.store";
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";

const updater = useUpdaterStore();
const appVersion = ref<string>("");

onMounted(async () => {
  try {
    appVersion.value = await getVersion();
  } catch {
    appVersion.value = updater.info?.currentVersion ?? "unknown";
  }
});

async function checkNow() {
  try {
    await updater.check();
    if (updater.status === "up-to-date") toast.success("You're on the latest version");
  } catch (err) {
    toast.error("Update check failed", { description: String(err) });
  }
}

async function onPrereleaseChange(value: boolean) {
  updater.setPrerelease(value);
  await checkNow();
}

async function installNow() {
  await updater.install();
  if (updater.status === "error" && updater.error) {
    toast.error("Update failed", { description: updater.error });
  }
}

function formatLastChecked(ts: number | null): string {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString();
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection title="Updates" description="Keep Capubridge up to date.">
      <SettingsRow label="Current version" description="The version you're running now">
        <span class="text-xs text-[var(--fg-muted)]">v{{ appVersion || "…" }}</span>
      </SettingsRow>

      <SettingsRow
        label="Receive pre-release updates"
        description="Get beta builds before they're released to everyone"
      >
        <Switch
          :model-value="updater.prerelease"
          :disabled="updater.isBusy"
          @update:model-value="onPrereleaseChange"
        />
      </SettingsRow>

      <SettingsRow
        label="Check for updates"
        :description="`Last checked: ${formatLastChecked(updater.lastChecked)}`"
      >
        <Button variant="outline" size="sm" :disabled="updater.isBusy" @click="checkNow">
          <RefreshCw :size="14" :class="updater.status === 'checking' ? 'animate-spin' : ''" />
          {{ updater.status === "checking" ? "Checking…" : "Check now" }}
        </Button>
      </SettingsRow>
    </SettingsSection>

    <!-- Up to date -->
    <div
      v-if="updater.status === 'up-to-date'"
      class="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] px-4 py-3 text-sm text-[var(--fg-muted)]"
    >
      <CheckCircle2 :size="16" class="text-[var(--accent)]" />
      You're running the latest version.
    </div>

    <!-- Update available / downloading -->
    <SettingsSection
      v-if="updater.updateAvailable || updater.status === 'downloading'"
      title="Update available"
      :description="updater.info ? `Version ${updater.info.version} is ready to install` : ''"
    >
      <div class="space-y-4 p-4">
        <div v-if="updater.info?.notes" class="space-y-1">
          <div class="text-xs font-medium text-[var(--fg-default)]">Release notes</div>
          <p class="max-h-48 overflow-y-auto whitespace-pre-line text-xs text-[var(--fg-muted)]">
            {{ updater.info.notes }}
          </p>
        </div>

        <!-- Progress -->
        <div v-if="updater.status === 'downloading'" class="space-y-2">
          <div class="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
            <div
              class="h-full rounded-full bg-[var(--accent)] transition-all duration-150"
              :style="{ width: `${updater.progressPct ?? 0}%` }"
            />
          </div>
          <div class="text-xs text-[var(--fg-muted)]">
            {{
              updater.progressPct !== null ? `Downloading… ${updater.progressPct}%` : "Downloading…"
            }}
          </div>
        </div>

        <Button v-else size="sm" :disabled="updater.isBusy" @click="installNow">
          <Download :size="14" />
          Install &amp; Restart
        </Button>
      </div>
    </SettingsSection>

    <!-- Error -->
    <div
      v-if="updater.status === 'error'"
      class="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] p-4"
    >
      <div class="flex items-start gap-2 text-sm text-[var(--fg-default)]">
        <AlertCircle :size="16" class="mt-0.5 shrink-0 text-destructive" />
        <div>
          <div class="font-medium">Update check failed</div>
          <p class="mt-0.5 break-words text-xs text-[var(--fg-muted)]">{{ updater.error }}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" :disabled="updater.isBusy" @click="checkNow">
        <RotateCw :size="14" />
        Retry
      </Button>
    </div>
  </div>
</template>
