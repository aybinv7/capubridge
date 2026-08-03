<script setup lang="ts">
import {
  Fragment,
  Text,
  isVNode,
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
import Surface from "../surface/Surface.vue";
import ShortcutGlyph, { type ShortcutGlyphName } from "./ShortcutGlyph.vue";
import VNodeRenderer from "./VNodeRenderer.ts";

type ShortcutEntry =
  | { kind: "glyph"; glyph: ShortcutGlyphName; padded: boolean }
  | { kind: "node"; node: VNode; padded: boolean }
  | { kind: "text"; text: string; padded: boolean };

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
    color?: UiAccent;
    iconClassName?: string;
    keyClassName?: string;
    keyContentClassName?: string;
    outline?: boolean;
    size?: UiSize;
    surfaceLevel?: SurfaceLevelInput;
    variant?: SurfaceVariant;
  }>(),
  {
    accent: undefined,
    as: "div",
    color: undefined,
    iconClassName: undefined,
    keyClassName: undefined,
    keyContentClassName: undefined,
    outline: true,
    size: "md",
    surfaceLevel: "+2",
    variant: "gradient",
  },
);

const slots = useSlots();
const isMac = ref(false);

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
  <component :is="props.as" v-bind="$attrs" class="cui-shortcut" :data-cui-size="props.size">
    <Surface
      v-for="(entry, index) in shortcutEntries()"
      :key="index"
      :accent="props.accent"
      :color="props.color"
      as="kbd"
      class="cui-shortcut__key"
      :class="[
        `cui-shortcut__key--${props.size}`,
        entry.padded && 'cui-shortcut__key--text',
        props.keyClassName,
      ]"
      :content-class-name="props.keyContentClassName"
      data-part="key"
      :level="props.surfaceLevel"
      :outline="props.outline"
      :variant="props.variant"
    >
      <ShortcutGlyph
        v-if="entry.kind === 'glyph'"
        :class="props.iconClassName"
        :name="entry.glyph"
      />
      <VNodeRenderer v-else-if="entry.kind === 'node'" :node="entry.node" />
      <template v-else>{{ entry.text }}</template>
    </Surface>
  </component>
</template>
