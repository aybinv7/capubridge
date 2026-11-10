<script setup lang="ts">
import { ArrowLeftRight } from "lucide-vue-next";
import type { MirrorSide } from "@/stores/mirror.store";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import LocalAddressField from "./LocalAddressField.vue";
import LocalReloadButton from "./LocalReloadButton.vue";
import MirrorScreenMenu from "./MirrorScreenMenu.vue";
import type { ReloadKind } from "./useLocalPageAddress";

/**
 * The toolbar under the tabs: reload, the tab's address, the swap that trades places between the
 * page and the panel beside it, and the screen settings.
 */
const props = defineProps<{ url: string; loading: boolean; side: MirrorSide }>();

const emit = defineEmits<{
  reload: [kind: ReloadKind];
  go: [url: string, newTab: boolean];
  invalid: [text: string];
  toggleSide: [];
}>();
</script>

<template>
  <div class="flex h-9 shrink-0 items-center gap-1 pr-1.5 pl-1.5">
    <LocalReloadButton :loading="props.loading" @reload="emit('reload', $event)" />

    <LocalAddressField
      :url="props.url"
      @go="(url, newTab) => emit('go', url, newTab)"
      @invalid="emit('invalid', $event)"
    />

    <IconAction
      :label="props.side === 'left' ? 'Put the page on the right' : 'Put the page on the left'"
      hint="Swaps the page and the panel beside it"
      size="sm"
      @click="emit('toggleSide')"
    >
      <ArrowLeftRight :stroke-width="1.8" />
    </IconAction>

    <MirrorScreenMenu
      :android-mode="false"
      :is-local="true"
      :side="props.side"
      :laser-mode="false"
      @refresh="emit('reload', 'normal')"
    />
  </div>
</template>
