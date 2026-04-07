<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Smartphone, Globe, Monitor, Zap, ExternalLink, RefreshCw } from "lucide-vue-next";
import { useCDP } from "@/composables/useCDP";
import type { CDPTarget } from "@/types/cdp.types";

const router = useRouter();
const { targetsStore, sourceStore, refreshTargets, connectToTarget } = useCDP();

const adbTargets = computed(() => targetsStore.targets.filter((t) => t.source === "adb"));

const chromeTargets = computed(() => targetsStore.targets.filter((t) => t.source === "chrome"));

const hasAdbSource = computed(() => sourceStore.hasAdbSource);
const hasChromeSource = computed(() => sourceStore.hasChromeSource);
const isFetching = computed(() => targetsStore.fetchingSources.size > 0);

async function handleInspect(target: CDPTarget) {
  targetsStore.selectTarget(target);
  try {
    await connectToTarget(target);
    await router.push("/storage/indexeddb");
  } catch (err) {
    console.error("CDP connect failed:", err);
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-8">
    <div class="max-w-3xl mx-auto space-y-6">
      <!-- Loading state -->
      <div v-if="isFetching" class="flex items-center justify-center py-12">
        <RefreshCw :size="20" class="animate-spin text-muted-foreground/40" />
        <span class="ml-3 text-sm text-muted-foreground/50">Fetching targets…</span>
      </div>

      <!-- No source connected -->
      <div v-else-if="!hasAdbSource && !hasChromeSource" class="py-12 text-center">
        <Smartphone :size="32" class="text-muted-foreground/20 mx-auto mb-3" />
        <p class="text-sm font-medium text-muted-foreground/40">No source connected</p>
        <p class="text-xs text-muted-foreground/25 mt-1">
          Select a device or connect Chrome to inspect webviews
        </p>
      </div>

      <!-- No targets found -->
      <div
        v-else-if="adbTargets.length === 0 && chromeTargets.length === 0"
        class="py-12 text-center"
      >
        <Monitor :size="32" class="text-muted-foreground/20 mx-auto mb-3" />
        <p class="text-sm font-medium text-muted-foreground/40">No inspectable targets found</p>
        <p class="text-xs text-muted-foreground/25 mt-1">
          Open a WebView on your device or a tab in Chrome
        </p>
        <button
          class="mt-4 text-xs text-foreground/60 hover:text-foreground underline"
          @click="refreshTargets()"
        >
          Refresh targets
        </button>
      </div>

      <!-- Device WebViews section -->
      <template v-if="adbTargets.length > 0">
        <div class="flex items-center gap-2.5 mb-2">
          <div class="w-2 h-2 rounded-full bg-status-success" />
          <span class="text-sm text-muted-foreground"
            >Device WebViews — Chrome DevTools Protocol</span
          >
        </div>

        <div
          v-for="target in adbTargets"
          :key="target.id"
          class="flex items-center gap-3 px-4 py-3 bg-surface-2 border border-border/30 rounded-lg hover:bg-surface-3/50 transition-colors group"
        >
          <div
            class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            :class="target.type === 'page' ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'"
          >
            <Monitor v-if="target.type === 'page'" class="w-3.5 h-3.5" />
            <Zap v-else class="w-3.5 h-3.5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-foreground truncate">
              {{ target.title || "(no title)" }}
            </div>
            <div class="text-xs font-mono text-muted-foreground/50 truncate mt-0.5">
              {{ target.url }}
            </div>
          </div>
          <span
            class="text-xs text-muted-foreground/50 px-2 py-0.5 rounded bg-surface-3 border border-border/20 shrink-0"
          >
            {{ target.type === "page" ? "page" : target.type }}
          </span>
          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/30 text-xs text-foreground/70 hover:text-foreground hover:bg-surface-3 transition-all opacity-0 group-hover:opacity-100 shrink-0"
            @click="handleInspect(target)"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            Inspect
          </button>
        </div>
      </template>

      <!-- Chrome Tabs section -->
      <template v-if="chromeTargets.length > 0">
        <div class="flex items-center gap-2.5 mb-2">
          <Globe :size="12" class="text-muted-foreground/50" />
          <span class="text-sm text-muted-foreground">Chrome Tabs</span>
        </div>

        <div
          v-for="target in chromeTargets"
          :key="target.id"
          class="flex items-center gap-3 px-4 py-3 bg-surface-2 border border-border/30 rounded-lg hover:bg-surface-3/50 transition-colors group"
        >
          <div
            class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            :class="target.type === 'page' ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'"
          >
            <Monitor v-if="target.type === 'page'" class="w-3.5 h-3.5" />
            <Zap v-else class="w-3.5 h-3.5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-foreground truncate">
              {{ target.title || "(no title)" }}
            </div>
            <div class="text-xs font-mono text-muted-foreground/50 truncate mt-0.5">
              {{ target.url }}
            </div>
          </div>
          <span
            class="text-xs text-muted-foreground/50 px-2 py-0.5 rounded bg-surface-3 border border-border/20 shrink-0"
          >
            {{ target.type === "page" ? "page" : target.type }}
          </span>
          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/30 text-xs text-foreground/70 hover:text-foreground hover:bg-surface-3 transition-all opacity-0 group-hover:opacity-100 shrink-0"
            @click="handleInspect(target)"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            Inspect
          </button>
        </div>
      </template>

      <!-- Refresh button -->
      <button
        class="flex items-center gap-2 text-muted-foreground/50 hover:text-foreground text-sm transition-colors"
        @click="refreshTargets()"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': isFetching }" />
        Refresh targets
      </button>
    </div>
  </div>
</template>
