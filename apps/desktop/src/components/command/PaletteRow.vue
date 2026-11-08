<script setup lang="ts">
import { CornerDownLeft, Info } from "lucide-vue-next";
import AppIcon from "@/shared/apps/AppIcon.vue";
import { bindingTokens } from "@/lib/commands/keymap";
import type { PaletteItem } from "@/lib/commands/palette/items";
import KeyCaps from "./KeyCaps.vue";

defineProps<{
  item: PaletteItem;
  highlighted: boolean;
}>();
</script>

<template>
  <div
    class="group flex h-full cursor-default items-center gap-3 rounded-control px-2 text-sm text-muted-foreground"
    :class="highlighted ? 'bg-cladd-surface-hover text-foreground' : ''"
  >
    <AppIcon
      v-if="item.kind === 'app'"
      :serial="item.app.serial"
      :apk-path="item.app.apkPath"
      :package-name="item.app.packageName"
      :icon-path="item.app.iconPath"
      :label="item.app.label"
      size="sm"
    />
    <span
      v-else
      class="grid size-6 shrink-0 place-items-center rounded-[7px] bg-surface-2 shadow-bevel"
      :class="highlighted ? 'bg-surface-3' : ''"
    >
      <component
        :is="item.kind === 'command' ? item.icon : Info"
        v-if="item.kind === 'notice' || item.icon"
        :size="13"
        :stroke-width="1.8"
        :class="highlighted ? 'text-foreground' : 'text-muted-foreground'"
      />
    </span>

    <span class="truncate text-foreground">{{ item.title }}</span>
    <span
      v-if="item.subtitle"
      class="min-w-0 flex-1 truncate text-xs text-[var(--fg-subtle)]"
      :class="item.kind === 'app' ? 'font-mono' : ''"
    >
      {{ item.subtitle }}
    </span>
    <span v-else class="flex-1" />

    <span
      v-if="item.kind === 'command' && item.note?.()"
      class="shrink-0 text-2xs text-[var(--fg-subtle)]"
    >
      {{ item.note() }}
    </span>
    <KeyCaps v-if="item.kind === 'command' && item.binding" :keys="bindingTokens(item.binding)" />
    <CornerDownLeft
      v-else
      :size="13"
      :stroke-width="1.8"
      class="shrink-0 text-[var(--fg-subtle)]"
      :class="highlighted ? 'opacity-100' : 'opacity-0'"
    />
  </div>
</template>
