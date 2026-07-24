<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Loader2, Play, RefreshCw, Smartphone } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useEmulators } from "@/composables/useEmulators";
import type { AndroidVirtualDevice } from "@/types/emulator.types";

const emit = defineEmits<{
  launched: [];
}>();

const { listAvds, launchAvd } = useEmulators();
const avds = ref<AndroidVirtualDevice[]>([]);
const loading = ref(false);
const launchingName = ref<string | null>(null);
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
  if (launchingName.value) return;
  launchingName.value = avdName;
  try {
    await launchAvd(avdName);
    toast.success("Emulator launch requested", {
      description: `${avdName} will appear when ADB is ready.`,
    });
    emit("launched");
  } catch (cause) {
    toast.error("Failed to launch emulator", { description: String(cause) });
  } finally {
    launchingName.value = null;
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div
      class="flex shrink-0 items-start justify-between gap-4 border-b border-border/15 px-6 pb-4 pt-5"
    >
      <div>
        <h2 class="text-[15px] font-semibold text-foreground">Android Emulators</h2>
        <p class="mt-0.5 text-[11px] text-muted-foreground/40">
          Launch an installed AVD. It will appear in Devices once ADB connects.
        </p>
      </div>
      <button
        class="flex h-8 items-center gap-1.5 rounded-lg border border-border/25 bg-surface-2 px-3 text-[11px] text-muted-foreground/60 transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-50"
        :disabled="loading"
        @click="void refresh()"
      >
        <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
        Refresh
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-5">
      <div
        v-if="error"
        class="rounded-xl border border-error/25 bg-error/5 px-4 py-3 text-[11px] text-error"
      >
        {{ error }}
      </div>

      <div
        v-else-if="loading && avds.length === 0"
        class="flex items-center gap-2 py-8 text-[11px] text-muted-foreground/35"
      >
        <Loader2 :size="13" class="animate-spin" />
        Discovering installed AVDs…
      </div>

      <div v-else-if="avds.length" class="space-y-2">
        <div
          v-for="avd in avds"
          :key="avd.name"
          class="flex items-center gap-3 rounded-xl border border-border/20 bg-surface-1/50 px-4 py-3"
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info"
          >
            <Smartphone :size="16" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[12px] font-medium text-foreground/85">{{ avd.name }}</p>
            <p class="mt-0.5 text-[10px] text-muted-foreground/35">Android Virtual Device</p>
          </div>
          <button
            class="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[11px] font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-45"
            :disabled="launchingName !== null"
            @click="void launch(avd.name)"
          >
            <Loader2 v-if="launchingName === avd.name" :size="12" class="animate-spin" />
            <Play v-else :size="12" />
            Launch
          </button>
        </div>
      </div>

      <div v-else class="flex flex-col items-center gap-2 py-12 text-center">
        <Smartphone :size="28" class="text-muted-foreground/15" />
        <p class="text-[12px] text-muted-foreground/35">No Android Virtual Devices found.</p>
        <p class="max-w-sm text-[11px] text-muted-foreground/25">
          Create an AVD in Android Studio, then refresh this list.
        </p>
      </div>
    </div>
  </div>
</template>
