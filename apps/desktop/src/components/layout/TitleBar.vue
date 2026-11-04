<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight, RectangleVertical, Search } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { Button } from "@capubridge/cladd";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useUIStore } from "@/stores/ui.store";
import BrandMark from "@/components/brand/BrandMark.vue";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { useBindingHint } from "@/composables/useBindingHint";
import RecordingButton from "@/modules/recording/RecordingButton.vue";
import ContextBar from "./ContextBar.vue";
import WindowControls from "./WindowControls.vue";

const emit = defineEmits<{ openCommandPalette: [] }>();

const router = useRouter();
const context = useActiveContextStore();
const mirrorStore = useMirrorStore();
const uiStore = useUIStore();
const { hint, keysOf } = useBindingHint();

const mirrorEnabled = computed(
  () => context.device?.status === "online" || context.target !== null,
);

const screenTitle = computed(() => {
  if (!mirrorEnabled.value) return "Connect a device or select a target to show its screen";
  return mirrorStore.isOpen ? "Hide the screen" : "Show the screen";
});

const paletteKeys = computed(() => keysOf("view.palette") ?? "");

const ghostIcon = "size-7 text-[var(--fg-subtle)] hover:text-foreground";
</script>

<template>
  <header
    class="relative flex h-11.5 shrink-0 select-none items-center gap-3 bg-background pl-3"
    style="-webkit-app-region: drag"
  >
    <div class="flex items-center gap-3" style="-webkit-app-region: no-drag">
      <Button
        variant="transparent"
        :outline="false"
        class="h-7.5 text-base font-semibold"
        content-class-name="gap-2 px-1"
        :title="hint('Toggle rail labels', 'view.toggle-rail')"
        aria-label="Toggle navigation rail labels"
        @click="uiStore.toggleSidebar()"
      >
        <BrandMark :size="20" />
        <span>Capubridge</span>
      </Button>

      <div class="flex items-center gap-0.5">
        <Button
          variant="transparent"
          :outline="false"
          square
          :class="ghostIcon"
          content-class-name="[&>svg]:size-3.5"
          title="Back"
          aria-label="Back"
          @click="router.back()"
        >
          <ChevronLeft :stroke-width="2" />
        </Button>
        <Button
          variant="transparent"
          :outline="false"
          square
          :class="ghostIcon"
          content-class-name="[&>svg]:size-3.5"
          title="Forward"
          aria-label="Forward"
          @click="router.forward()"
        >
          <ChevronRight :stroke-width="2" />
        </Button>
      </div>
    </div>

    <div class="mx-auto flex min-w-0 items-center" style="-webkit-app-region: no-drag">
      <ContextBar />
    </div>

    <div class="flex items-center gap-3" style="-webkit-app-region: no-drag">
      <RecordingButton />

      <Button
        variant="solid"
        surface-level="1"
        :outline="false"
        class="h-7.5 w-55 border border-border text-sm font-normal text-[var(--fg-subtle)] hover:text-foreground"
        content-class-name="justify-start gap-2.5 px-2.5 [&>svg]:size-3.5"
        aria-label="Search or run a command"
        @click="emit('openCommandPalette')"
      >
        <Search :stroke-width="1.8" />
        <span>Search or run</span>
        <KeyCaps v-if="paletteKeys" :keys="paletteKeys" quiet class="ml-auto" />
      </Button>

      <Button
        :variant="mirrorStore.isOpen ? 'solid' : 'transparent'"
        :surface-level="mirrorStore.isOpen ? '2' : undefined"
        :outline="false"
        square
        class="size-7.5 border border-border"
        :class="mirrorStore.isOpen ? 'text-foreground' : 'text-muted-foreground'"
        content-class-name="[&>svg]:size-3.5"
        :disabled="!mirrorEnabled"
        :aria-pressed="mirrorStore.isOpen"
        :title="screenTitle"
        aria-label="Toggle screen"
        @click="mirrorStore.toggle()"
      >
        <RectangleVertical :stroke-width="1.8" />
      </Button>
    </div>

    <WindowControls />
  </header>
</template>
