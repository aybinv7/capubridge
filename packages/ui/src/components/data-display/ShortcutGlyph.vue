<script setup lang="ts">
import { computed } from "vue";

export type ShortcutGlyphName =
  | "alt"
  | "backspace"
  | "cmd"
  | "ctrl"
  | "down"
  | "enter"
  | "left"
  | "right"
  | "shift"
  | "space"
  | "tab"
  | "up";

const props = defineProps<{
  name: ShortcutGlyphName;
}>();

const paths: Record<ShortcutGlyphName, string> = {
  alt: "M591-200 314-680H120v-80h240l277 480h203v80H591Zm9-480v-80h240v80H600Z",
  backspace:
    "m456-320 104-104 104 104 56-56-104-104 104-104-56-56-104 104-104-104-56 56 104 104-104 104 56 56Zm-96 160q-19 0-36-8.5T296-192L80-480l216-288q11-15 28-23.5t36-8.5h440q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H360ZM180-480l180 240h440v-480H360L180-480Zm400 0Z",
  cmd: "M260-120q-58 0-99-41t-41-99q0-58 41-99t99-41h60v-160h-60q-58 0-99-41t-41-99q0-58 41-99t99-41q58 0 99 41t41 99v60h160v-60q0-58 41-99t99-41q58 0 99 41t41 99q0 58-41 99t-99 41h-60v160h60q58 0 99 41t41 99q0 58-41 99t-99 41q-58 0-99-41t-41-99v-60H400v60q0 58-41 99t-99 41Zm0-80q25 0 42.5-17.5T320-260v-60h-60q-25 0-42.5 17.5T200-260q0 25 17.5 42.5T260-200Zm440 0q25 0 42.5-17.5T760-260q0-25-17.5-42.5T700-320h-60v60q0 25 17.5 42.5T700-200ZM400-400h160v-160H400v160ZM260-640h60v-60q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Zm380 0h60q25 0 42.5-17.5T760-700q0-25-17.5-42.5T700-760q-25 0-42.5 17.5T640-700v60Z",
  ctrl: "m256-424-56-56 280-280 280 280-56 56-224-223-224 223Z",
  down: "m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z",
  enter: "M360-240 120-480l240-240 56 56-144 144h488v-160h80v240H272l144 144-56 56Z",
  left: "m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z",
  right: "m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z",
  shift: "M320-120v-320H120l360-440 360 440H640v320H320Z",
  space: "M160-360v-240h80v160h480v-160h80v240H160Z",
  tab: "M800-240v-480h80v480h-80Zm-320 0-57-56 144-144H80v-80h487L424-664l56-56 240 240-240 240Z",
  up: "m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z",
};

const rotation = computed(() => {
  if (props.name === "up") return "90deg";
  if (props.name === "down") return "-90deg";
  if (props.name === "right") return "180deg";
  return undefined;
});
</script>

<template>
  <svg
    fill="currentColor"
    height="24"
    :style="{ transform: rotation ? `rotate(${rotation})` : undefined }"
    viewBox="0 -960 960 960"
    width="24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path :d="paths[props.name]" />
  </svg>
</template>
