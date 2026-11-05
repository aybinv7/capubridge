<script setup lang="ts">
import type { Component } from "vue";
import { AppWindow, Bug, Globe, Monitor, Server, Smartphone } from "lucide-vue-next";
import type { ChainLink, ChainLinkState } from "@/lib/gates/types";

defineProps<{ links: readonly ChainLink[] }>();

function iconOf(link: ChainLink): Component {
  if (link.key === "adb") return Server;
  if (link.key === "link") return Bug;
  if (link.key === "target") return AppWindow;
  if (link.value === "This PC") return Monitor;
  if (link.value === "Chrome") return Globe;
  return Smartphone;
}

const TILE: Record<ChainLinkState, string> = {
  ok: "bg-surface-2 text-foreground shadow-bevel",
  pending:
    "bg-surface-2 text-warning shadow-bevel ring-1 ring-warning/50 motion-safe:animate-pulse",
  broken:
    "bg-surface-cut text-error shadow-cut outline-1 outline-dashed outline-offset-2 outline-error/60",
  idle: "bg-surface-cut text-[var(--fg-subtle)] shadow-cut opacity-60",
};

const BADGE: Record<ChainLinkState, string> = {
  ok: "bg-success",
  pending: "bg-warning",
  broken: "bg-error",
  idle: "bg-[var(--border-strong)]",
};

const VALUE: Record<ChainLinkState, string> = {
  ok: "text-muted-foreground",
  pending: "text-warning",
  broken: "text-error",
  idle: "text-[var(--fg-subtle)]",
};

function connectorClass(left: ChainLink, right: ChainLink) {
  if (left.state === "ok" && right.state === "ok") return "border-success/60 border-solid";
  if (left.state === "ok" && right.state === "pending") return "border-warning/60 border-dashed";
  return "border-[var(--border-strong)] border-dashed";
}
</script>

<template>
  <ol class="flex items-start justify-center" aria-label="Connection chain">
    <template v-for="(link, index) in links" :key="link.key">
      <li
        v-if="index > 0"
        class="mt-6 h-0 w-10 shrink border-t-2 sm:w-14"
        :class="connectorClass(links[index - 1], link)"
        aria-hidden="true"
      />
      <li class="flex w-24 shrink-0 flex-col items-center gap-2" :data-state="link.state">
        <span
          class="relative grid size-12 place-items-center rounded-surface"
          :class="TILE[link.state]"
        >
          <component :is="iconOf(link)" :size="20" :stroke-width="1.6" aria-hidden="true" />
          <span
            class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[var(--bg-surface)]"
            :class="BADGE[link.state]"
            aria-hidden="true"
          />
        </span>
        <span class="flex w-full flex-col items-center gap-0.5 text-center">
          <span class="text-2xs text-muted-foreground">{{ link.label }}</span>
          <span class="max-w-full truncate font-mono text-2xs" :class="VALUE[link.state]">
            {{ link.value }}
          </span>
          <span class="sr-only">({{ link.state }})</span>
        </span>
      </li>
    </template>
  </ol>
</template>
