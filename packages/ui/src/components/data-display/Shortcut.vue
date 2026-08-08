<script setup lang="ts">
import {
  Fragment,
  Text,
  isVNode,
  computed,
  onBeforeMount,
  ref,
  useSlots,
  type Component,
  type VNode,
} from "vue";

import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiAccent,
  UiSize,
} from "../../foundations/contracts.ts";
import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { cn } from "../../shared/cn.ts";
import { nestedSizeClasses } from "../../shared/sizeClasses.ts";
import Surface from "../surface/Surface.vue";
import ShortcutGlyph, { type ShortcutGlyphName } from "./ShortcutGlyph.vue";
import {
  shortcutFontSizes,
  shortcutIconSizes,
  shortcutRoundedClasses,
} from "./shortcut.contracts.ts";
import type { ShortcutProps } from "./dataDisplay.contracts.ts";
import VNodeRenderer from "./VNodeRenderer.ts";

type ShortcutEntry =
  | { kind: "glyph"; glyph: ShortcutGlyphName; padded: boolean }
  | { kind: "node"; node: VNode; padded: boolean }
  | { kind: "text"; text: string; padded: boolean };

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ShortcutProps>(), {
  accent: undefined,
  as: undefined,
  color: undefined,
  iconClassName: undefined,
  keyClassName: undefined,
  keyContentClassName: undefined,
  outline: undefined,
  size: undefined,
  surfaceLevel: undefined,
  variant: undefined,
});

const d = useComponentDefaults("Shortcut", props, {
  as: "div" as string | Component,
  outline: true,
  size: "md" as UiSize,
  surfaceLevel: "+2" as SurfaceLevelInput,
  variant: "gradient" as SurfaceVariant,
});

const slots = useSlots();
const isMac = ref(false);
const isFill = computed(
  () => d.value.variant === "solid-fill" || d.value.variant === "gradient-fill",
);

const rootClass = computed(() =>
  cn(
    "cui-shortcut inline-flex shrink-0 items-center gap-0.5 self-center align-middle font-mono leading-0 tabular-nums",
  ),
);

const keyClass = computed(() =>
  cn(
    "cui-shortcut__key relative shrink-0 font-semibold",
    !isFill.value && "text-cui-primary",
    shortcutFontSizes[d.value.size],
    shortcutRoundedClasses[d.value.size],
    nestedSizeClasses(d.value.size, "height"),
    nestedSizeClasses(d.value.size, "min-width"),
    d.value.keyClassName,
  ),
);

function keyContentClass(padded: boolean): string {
  return cn(
    "flex items-center justify-center px-0.5",
    padded && "px-1",
    d.value.keyContentClassName,
  );
}

const glyphClass = computed(() => cn(shortcutIconSizes[d.value.size], d.value.iconClassName));

function tokenEntry(token: string): ShortcutEntry {
  const key = token.toLowerCase();
  const padded = ![
    "cmd",
    "ctrl",
    "alt",
    "shift",
    "backspace",
    "delete",
    "del",
    "enter",
    "return",
    "space",
    "up",
    "down",
    "left",
    "right",
  ].includes(key);

  if (key === "cmd") {
    return isMac.value
      ? { glyph: "cmd", kind: "glyph", padded }
      : { kind: "text", padded, text: "CTRL" };
  }

  if (key === "ctrl") {
    return isMac.value
      ? { glyph: "ctrl", kind: "glyph", padded }
      : { kind: "text", padded, text: "CTRL" };
  }

  if (key === "alt") {
    return isMac.value
      ? { glyph: "alt", kind: "glyph", padded }
      : { kind: "text", padded, text: "ALT" };
  }

  if (key === "shift") return { glyph: "shift", kind: "glyph", padded };
  if (["backspace", "delete", "del"].includes(key)) {
    return { glyph: "backspace", kind: "glyph", padded };
  }
  if (["escape", "esc"].includes(key)) return { kind: "text", padded, text: "ESC" };
  if (["enter", "return"].includes(key)) return { glyph: "enter", kind: "glyph", padded };
  if (key === "tab") return { glyph: "tab", kind: "glyph", padded };
  if (key === "space") return { glyph: "space", kind: "glyph", padded };
  if (["up", "down", "left", "right"].includes(key)) {
    return { glyph: key as ShortcutGlyphName, kind: "glyph", padded };
  }

  return { kind: "text", padded, text: key.toUpperCase() };
}

function collectShortcutEntries(nodes: VNode[], entries: ShortcutEntry[]): void {
  for (const node of nodes) {
    if (node.type === Text && typeof node.children === "string") {
      const tokens = node.children.trim().split(/\s+/).filter(Boolean);
      entries.push(...tokens.map(tokenEntry));
      continue;
    }

    if (node.type === Fragment && Array.isArray(node.children)) {
      collectShortcutEntries(node.children.filter(isVNode), entries);
      continue;
    }

    entries.push({ kind: "node", node, padded: false });
  }
}

function shortcutEntries(): ShortcutEntry[] {
  const entries: ShortcutEntry[] = [];
  collectShortcutEntries(slots.default?.() ?? [], entries);
  return entries;
}

onBeforeMount(() => {
  isMac.value = typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");
});
</script>

<template>
  <component :is="d.as" v-bind="$attrs" class="cui-shortcut" :data-cui-size="d.size">
    <Surface
      v-for="(entry, index) in shortcutEntries()"
      :key="index"
      :accent="d.accent"
      :color="d.color"
      as="kbd"
      :class="keyClass"
      :content-class-name="keyContentClass(entry.padded)"
      data-part="key"
      :level="d.surfaceLevel"
      :outline="d.outline"
      :variant="d.variant"
    >
      <ShortcutGlyph v-if="entry.kind === 'glyph'" :class="glyphClass" :name="entry.glyph" />
      <VNodeRenderer v-else-if="entry.kind === 'node'" :node="entry.node" />
      <template v-else>{{ entry.text }}</template>
    </Surface>
  </component>
</template>
