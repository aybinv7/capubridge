<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { AlertTriangle, Globe2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BrowserPreviewAddressBar from "@/modules/browser-preview/BrowserPreviewAddressBar.vue";
import { BROWSER_PREVIEW_PORT_PRESETS } from "@/modules/browser-preview/browserPreview.constants";
import { isLocalPreviewUrl } from "@/modules/browser-preview/browserPreviewUrl";
import { useBrowserPreviewStore } from "@/modules/browser-preview/stores/useBrowserPreviewStore";

const store = useBrowserPreviewStore();
const { url, loadVersion, notice, checkingPort, recentUrls, hasUrl } = storeToRefs(store);
const iframeKey = computed(() => `${url.value}:${loadVersion.value}`);
const showEmbedHint = computed(() => hasUrl.value && !isLocalPreviewUrl(url.value));
const primaryPresets = computed(() => BROWSER_PREVIEW_PORT_PRESETS.slice(0, 6));
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-surface-0">
    <BrowserPreviewAddressBar
      :url="url"
      :checking-port="checkingPort"
      :recent-urls="recentUrls"
      @navigate="store.navigate"
      @reload="store.reload"
      @clear="store.clear"
      @open-port="store.openPortPreset"
    />

    <div
      v-if="notice"
      class="flex h-7 shrink-0 items-center gap-2 border-b border-amber-500/15 bg-amber-500/8 px-3 text-[11px] text-amber-300/90"
    >
      <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
      <span class="truncate">{{ notice }}</span>
    </div>

    <div
      v-if="showEmbedHint"
      class="flex h-7 shrink-0 items-center gap-2 border-b border-border/20 bg-surface-1 px-3 text-[11px] text-muted-foreground/60"
    >
      <AlertTriangle class="h-3.5 w-3.5 shrink-0 text-amber-300/80" />
      <span class="truncate">External pages can block iframe embedding.</span>
    </div>

    <div class="min-h-0 flex-1 bg-white">
      <iframe
        v-if="hasUrl"
        :key="iframeKey"
        :src="url"
        title="Browser preview"
        class="h-full w-full border-0"
        allow="clipboard-read; clipboard-write; fullscreen"
      />

      <div
        v-else
        class="flex h-full w-full flex-col items-center justify-center gap-5 bg-surface-0 px-8 text-center"
      >
        <div
          class="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/35 bg-surface-2 text-muted-foreground/70"
        >
          <Globe2 class="h-6 w-6" />
        </div>
        <div class="space-y-1">
          <div class="text-sm font-medium text-foreground">Preview</div>
          <div class="text-xs text-muted-foreground/55">Local web app surface</div>
        </div>
        <div class="flex max-w-xl flex-wrap items-center justify-center gap-1.5">
          <Button
            v-for="preset in primaryPresets"
            :key="preset.port"
            variant="outline"
            size="sm"
            class="h-7 gap-2 border-border/35 bg-surface-1 px-2.5 text-xs"
            @click="store.openPortPreset(preset)"
          >
            {{ preset.label }}
            <Badge variant="outline" class="border-border/30 px-1.5 py-0 font-mono text-[10px]">
              :{{ preset.port }}
            </Badge>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
