<script setup lang="ts">
import { ChevronsUpDown, Monitor } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import type { MirrorSide } from "@/stores/mirror.store";
import type { AddressResolution } from "@/lib/local-address";
import LocalAddressField from "./LocalAddressField.vue";
import LocalReloadButton from "./LocalReloadButton.vue";
import MirrorScreenMenu from "./MirrorScreenMenu.vue";
import type { ReloadKind } from "./useLocalPageAddress";

/**
 * The Screen header for a page on This PC: where it runs (opens the device manager to switch),
 * reload, the address, and the screen settings. Replaces the plain "Screen" title, because the
 * address and reload are what a web page needs most often.
 */
const props = defineProps<{ url: string; loading: boolean; side: MirrorSide }>();

const emit = defineEmits<{
  switchDevice: [];
  reload: [kind: ReloadKind];
  go: [resolution: AddressResolution];
  invalid: [text: string];
  toggleSide: [];
}>();
</script>

<template>
  <header class="flex h-10 shrink-0 items-center gap-1 pr-1.5 pl-1.5">
    <Button
      variant="transparent"
      :outline="false"
      size="xs"
      class="shrink-0"
      content-class-name="gap-1.5 px-1.5 text-xs font-medium text-foreground"
      title="Switch to a phone, an app or another page"
      @click="emit('switchDevice')"
    >
      <Monitor :stroke-width="1.8" class="size-3.5 text-muted-foreground" aria-hidden="true" />
      This PC
      <ChevronsUpDown
        :stroke-width="1.8"
        class="size-3 text-[var(--fg-subtle)]"
        aria-hidden="true"
      />
    </Button>

    <LocalReloadButton :loading="props.loading" @reload="emit('reload', $event)" />

    <LocalAddressField
      :url="props.url"
      @go="emit('go', $event)"
      @invalid="emit('invalid', $event)"
    />

    <MirrorScreenMenu
      :android-mode="false"
      :is-local="true"
      :side="props.side"
      :laser-mode="false"
      @toggle-side="emit('toggleSide')"
      @refresh="emit('reload', 'normal')"
    />
  </header>
</template>
