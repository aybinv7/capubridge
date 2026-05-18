<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Smartphone, FileVideo, Command } from "lucide-vue-next";
import { useDevicesStore } from "@/stores/devices.store";

const router = useRouter();
const devicesStore = useDevicesStore();

const recentTargets = computed(() => devicesStore.devices.slice(0, 5));

function openDevices() {
  void router.push("/devices");
}

function openRecordings() {
  void router.push("/replay");
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-8 py-12">
    <div class="w-full max-w-2xl text-center">
      <h1 class="text-3xl font-medium tracking-tight text-[var(--fg-default)]">capubridge</h1>
      <p class="mt-2 text-sm text-[var(--fg-muted)]">Hybrid app devtools, native.</p>

      <div class="mx-auto mt-8 grid w-full max-w-md grid-cols-2 gap-3">
        <button
          type="button"
          class="flex flex-col items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] px-4 py-6 text-sm text-[var(--fg-default)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)]"
          @click="openDevices"
        >
          <Smartphone :size="18" class="text-[var(--accent)]" />
          <span class="font-medium">Connect device</span>
          <span class="text-xs text-[var(--fg-muted)]">Scan for ADB devices</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] px-4 py-6 text-sm text-[var(--fg-default)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)]"
          @click="openRecordings"
        >
          <FileVideo :size="18" class="text-[var(--fg-muted)]" />
          <span class="font-medium">Open recording</span>
          <span class="text-xs text-[var(--fg-muted)]">Replay a .capu file</span>
        </button>
      </div>

      <div v-if="recentTargets.length > 0" class="mx-auto mt-10 max-w-md text-left">
        <div class="mb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
          Recent targets
        </div>
        <ul class="space-y-1">
          <li
            v-for="t in recentTargets"
            :key="t.serial"
            class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-surface-raised)]"
          >
            <span class="inline-flex items-center gap-2">
              <Smartphone :size="14" class="text-[var(--fg-muted)]" />
              {{ t.model ?? t.serial }}
            </span>
            <span class="text-xs text-[var(--fg-muted)]">{{ t.status }}</span>
          </li>
        </ul>
      </div>

      <p class="mt-10 inline-flex items-center gap-2 text-xs text-[var(--fg-subtle)]">
        <Command :size="12" />
        <kbd
          class="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px]"
          >⌘K</kbd
        >
        to open the command palette
      </p>
    </div>
  </div>
</template>
