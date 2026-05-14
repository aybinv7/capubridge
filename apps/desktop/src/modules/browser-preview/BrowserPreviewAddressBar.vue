<script setup lang="ts">
import { ref, watch } from "vue";
import { CircleX, Globe2, Loader2, RotateCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BROWSER_PREVIEW_PORT_PRESETS } from "@/modules/browser-preview/browserPreview.constants";
import type { BrowserPreviewPortPreset } from "@/modules/browser-preview/browserPreview.constants";

const props = defineProps<{
  url: string;
  checkingPort: number | null;
  recentUrls: string[];
}>();

const emit = defineEmits<{
  navigate: [url: string];
  reload: [];
  clear: [];
  openPort: [preset: BrowserPreviewPortPreset];
}>();

const draft = ref(props.url);

watch(
  () => props.url,
  (url) => {
    draft.value = url;
  },
);

function submit() {
  emit("navigate", draft.value);
}
</script>

<template>
  <div class="flex shrink-0 flex-col border-b border-border/30 bg-surface-1">
    <div class="flex h-10 items-center gap-1.5 px-2">
      <Button
        variant="ghost"
        size="icon-sm"
        title="Reload"
        :disabled="!url"
        class="text-muted-foreground/60 hover:text-foreground"
        @click="emit('reload')"
      >
        <RotateCw class="h-3.5 w-3.5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 gap-1.5 px-2 text-xs text-muted-foreground/65 hover:text-foreground"
          >
            <Globe2 class="h-3.5 w-3.5" />
            Ports
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="max-h-80 w-60 overflow-y-auto">
          <DropdownMenuLabel>Local dev servers</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            v-for="preset in BROWSER_PREVIEW_PORT_PRESETS"
            :key="preset.port"
            class="gap-2"
            @click="emit('openPort', preset)"
          >
            <span class="flex-1">{{ preset.label }}</span>
            <span class="text-[11px] text-muted-foreground/55">
              {{ checkingPort === preset.port ? "checking" : `:${preset.port}` }}
            </span>
          </DropdownMenuItem>
          <template v-if="recentUrls.length">
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            <DropdownMenuItem
              v-for="recentUrl in recentUrls"
              :key="recentUrl"
              class="max-w-56 truncate font-mono text-[11px]"
              @click="emit('navigate', recentUrl)"
            >
              {{ recentUrl }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>

      <div
        class="flex min-w-0 flex-1 items-center rounded-md border border-border/25 bg-surface-2 transition-colors focus-within:border-border/60"
      >
        <Input
          v-model="draft"
          class="h-7 border-0 bg-transparent px-2 font-mono text-xs focus-visible:ring-0"
          placeholder="http://localhost:5173"
          spellcheck="false"
          autocomplete="off"
          @keydown.enter.prevent="submit"
          @keydown.escape.prevent="draft = url"
        />
      </div>

      <Button
        variant="default"
        size="sm"
        class="h-7 px-3 text-xs"
        :disabled="checkingPort !== null"
        @click="submit"
      >
        <Loader2 v-if="checkingPort !== null" class="h-3.5 w-3.5 animate-spin" />
        Open
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        title="Clear"
        :disabled="!url"
        class="text-muted-foreground/60 hover:text-foreground"
        @click="emit('clear')"
      >
        <CircleX class="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
</template>
