<script setup lang="ts">
import { onMounted, ref } from "vue";
import { MonitorSmartphone, Play, RefreshCw, Square } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button, Spinner, StatusDot } from "@capubridge/cladd";
import { useEmulators } from "@/composables/useEmulators";
import type { AndroidVirtualDevice } from "@/types/emulator.types";
import IconAction from "@/shared/components/presentation/IconAction.vue";

const emit = defineEmits<{ launched: [] }>();

const { listAvds, launchAvd, stopAvd } = useEmulators();
const avds = ref<AndroidVirtualDevice[]>([]);
const loading = ref(false);
const busyName = ref<string | null>(null);
const error = ref<string | null>(null);

async function refresh() {
  if (loading.value) return;
  loading.value = true;
  error.value = null;
  try {
    avds.value = await listAvds();
  } catch (cause) {
    error.value = String(cause);
  } finally {
    loading.value = false;
  }
}

async function launch(avdName: string) {
  if (busyName.value) return;
  busyName.value = avdName;
  try {
    const result = await launchAvd(avdName);
    if (result.alreadyRunning) {
      toast.info("Emulator already running", {
        description: `${avdName} is ${result.serial ?? "already registered with ADB"}.`,
      });
    } else {
      toast.success("Emulator starting", {
        description: `${avdName} appears in the device list once it has booted, usually within 30 s.`,
      });
    }
    emit("launched");
  } catch (cause) {
    toast.error("Could not start the emulator", { description: String(cause) });
  } finally {
    busyName.value = null;
    void refresh();
  }
}

async function stop(avdName: string) {
  if (busyName.value) return;
  busyName.value = avdName;
  try {
    const result = await stopAvd(avdName);
    toast.success("Emulator stopped", {
      description: `${result.serial ?? `pid ${result.pid}`} was terminated. The next start is a cold boot.`,
    });
  } catch (cause) {
    toast.error("Could not stop the emulator", { description: String(cause) });
  } finally {
    busyName.value = null;
    void refresh();
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="flex items-start gap-3 px-5 pt-5 pb-4">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <h2 class="text-base font-medium text-foreground">Emulators</h2>
        <p class="text-2xs text-[var(--fg-subtle)]">
          Android Virtual Devices installed with the Android SDK. A started emulator joins the
          device list once ADB sees it.
        </p>
      </div>
      <IconAction label="Look for emulators again" :disabled="loading" @click="refresh">
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
    </header>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4">
      <div
        v-if="error"
        class="mx-2 flex flex-col gap-1 rounded-well bg-surface-cut px-4 py-3 shadow-cut"
        role="alert"
      >
        <p class="text-sm text-foreground">Could not list emulators</p>
        <p class="font-mono text-2xs break-words text-error">{{ error }}</p>
        <p class="text-xs text-muted-foreground">
          Check that the Android SDK is installed and ANDROID_HOME points to it.
        </p>
      </div>

      <div
        v-else-if="loading && avds.length === 0"
        class="flex items-center gap-2 px-2 py-6 text-xs text-muted-foreground"
      >
        <Spinner size="xs" /> Looking for installed emulators
      </div>

      <ul v-else-if="avds.length" class="flex flex-col gap-0.5">
        <li
          v-for="avd in avds"
          :key="avd.name"
          class="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-cladd-surface-hover"
        >
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-inner bg-surface-2 text-muted-foreground"
          >
            <MonitorSmartphone :size="15" :stroke-width="1.7" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm text-foreground">{{ avd.name }}</span>
            <span class="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <template v-if="avd.running?.serial">
                <StatusDot color="green" size="xs" />
                Running as <span class="font-mono">{{ avd.running.serial }}</span>
              </template>
              <template v-else-if="avd.running">
                <StatusDot color="yellow" size="xs" pulse />
                Booting, not on ADB yet
                <span class="font-mono text-[var(--fg-subtle)]">pid {{ avd.running.pid }}</span>
              </template>
              <template v-else>
                <StatusDot variant="hollow" size="xs" />
                Stopped
              </template>
            </span>
          </span>
          <Button
            v-if="avd.running"
            variant="transparent"
            size="sm"
            :loading="busyName === avd.name"
            :disabled="busyName !== null && busyName !== avd.name"
            content-class-name="gap-1.5 px-2.5 [&>svg]:size-3"
            @click="stop(avd.name)"
          >
            <Square :stroke-width="2" />
            Stop
          </Button>
          <Button
            v-else
            variant="solid"
            surface-level="+2"
            size="sm"
            :loading="busyName === avd.name"
            :disabled="busyName !== null && busyName !== avd.name"
            content-class-name="gap-1.5 px-2.5 [&>svg]:size-3"
            @click="launch(avd.name)"
          >
            <Play :stroke-width="2" />
            Start
          </Button>
        </li>
      </ul>

      <div v-else class="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
        <p class="text-sm text-foreground">No emulators installed</p>
        <p class="max-w-sm text-xs text-muted-foreground">
          Create one in Android Studio (Device Manager › Create virtual device), then look again.
        </p>
      </div>
    </div>
  </div>
</template>
