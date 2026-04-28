<script setup lang="ts">
import { computed, watch } from "vue";
import { AppWindow, RefreshCw, Shield, ShieldAlert, ShieldCheck, ShieldX } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppPermissionsTab from "./AppPermissionsTab.vue";
import { useAppPanel } from "./useAppPanel";

const panel = useAppPanel();

watch(
  () => panel.packageName.value,
  (value) => {
    if (!value) {
      return;
    }
    if (!panel.inspector.permissions.value && !panel.inspector.isLoadingPerms.value) {
      void panel.inspector.fetchPermissions();
    }
  },
  { immediate: true },
);

const stats = computed(() => {
  const runtime = panel.inspector.permissions.value?.runtime ?? [];
  return {
    total: runtime.length,
    granted: runtime.filter((entry) => entry.granted).length,
    denied: runtime.filter((entry) => !entry.granted).length,
    sensitive: runtime.filter((entry) => entry.isDangerous).length,
  };
});

async function refreshPermissions() {
  panel.inspector.invalidatePackageDump();
  await panel.inspector.fetchPermissions({ force: true });
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <div
      v-if="!panel.selectedTarget.value || !panel.packageName.value"
      class="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center"
    >
      <div
        class="flex h-16 w-16 items-center justify-center rounded-[24px] border border-border/25 bg-surface-1/90"
      >
        <AppWindow class="h-7 w-7 text-muted-foreground/35" />
      </div>
      <div class="text-lg font-medium text-foreground/80">No app target selected</div>
    </div>

    <ScrollArea v-else class="h-full">
      <div class="space-y-6 px-6 py-6">
        <div class="grid gap-4 md:grid-cols-4">
          <div class="rounded-[22px] border border-border/25 bg-surface-1/90 p-4">
            <div class="flex items-center gap-2 text-xs text-muted-foreground/55">
              <Shield class="h-4 w-4 text-sky-400" />
              Runtime
            </div>
            <div class="mt-3 text-3xl font-semibold text-foreground">
              {{ stats.total }}
            </div>
          </div>

          <div class="rounded-[22px] border border-emerald-500/15 bg-emerald-500/6 p-4">
            <div class="flex items-center gap-2 text-xs text-emerald-200/80">
              <ShieldCheck class="h-4 w-4" />
              Granted
            </div>
            <div class="mt-3 text-3xl font-semibold text-emerald-300">
              {{ stats.granted }}
            </div>
          </div>

          <div class="rounded-[22px] border border-red-500/15 bg-red-500/6 p-4">
            <div class="flex items-center gap-2 text-xs text-red-200/80">
              <ShieldX class="h-4 w-4" />
              Denied
            </div>
            <div class="mt-3 text-3xl font-semibold text-red-300">
              {{ stats.denied }}
            </div>
          </div>

          <div class="rounded-[22px] border border-amber-500/15 bg-amber-500/6 p-4">
            <div class="flex items-center gap-2 text-xs text-amber-200/80">
              <ShieldAlert class="h-4 w-4" />
              Sensitive
            </div>
            <div class="mt-3 text-3xl font-semibold text-amber-300">
              {{ stats.sensitive }}
            </div>
          </div>
        </div>

        <div class="rounded-[24px] border border-border/25 bg-surface-1/90 p-2">
          <AppPermissionsTab
            :permissions="panel.inspector.permissions.value"
            :is-loading="panel.inspector.isLoadingPerms.value"
            :error="panel.inspector.permsError.value"
            @refresh="void refreshPermissions()"
          />
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
