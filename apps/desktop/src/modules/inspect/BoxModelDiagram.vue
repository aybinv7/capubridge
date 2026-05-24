<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import type { BoxModel, ComputedStyle } from "@/types/inspect.types";
import { useInspectStore } from "@/stores/inspect.store";
import { useCDP } from "@/composables/useCDP";
import { OverlayDomain } from "utils";

const props = defineProps<{
  boxModel: BoxModel | null;
  computedStyles: ComputedStyle[];
}>();

const store = useInspectStore();
const { selectedNodeId } = storeToRefs(store);
const { activeClient } = useCDP();

const overlay = ref<OverlayDomain | null>(null);
watch(
  activeClient,
  (c) => {
    overlay.value = c ? new OverlayDomain(c) : null;
  },
  { immediate: true },
);

function getStyle(name: string): string {
  return props.computedStyles.find((s) => s.name === name)?.value ?? "—";
}

function shortVal(v: string): string {
  if (v === "—") return v;
  const n = parseFloat(v);
  if (!Number.isNaN(n) && /^[-\d.]+px$/.test(v)) return String(n);
  return v;
}

const margin = computed(() => ({
  top: shortVal(getStyle("margin-top")),
  right: shortVal(getStyle("margin-right")),
  bottom: shortVal(getStyle("margin-bottom")),
  left: shortVal(getStyle("margin-left")),
}));

const border = computed(() => ({
  top: shortVal(getStyle("border-top-width")),
  right: shortVal(getStyle("border-right-width")),
  bottom: shortVal(getStyle("border-bottom-width")),
  left: shortVal(getStyle("border-left-width")),
}));

const padding = computed(() => ({
  top: shortVal(getStyle("padding-top")),
  right: shortVal(getStyle("padding-right")),
  bottom: shortVal(getStyle("padding-bottom")),
  left: shortVal(getStyle("padding-left")),
}));

const content = computed(() => {
  if (!props.boxModel) return { width: "—", height: "—" };
  return {
    width: String(Math.round(props.boxModel.width)),
    height: String(Math.round(props.boxModel.height)),
  };
});

const position = computed(() => getStyle("position"));
const display = computed(() => getStyle("display"));

type Region = "margin" | "border" | "padding" | "content" | null;
const hoveredRegion = ref<Region>(null);

async function highlight(region: Region) {
  hoveredRegion.value = region;
  const id = selectedNodeId.value;
  if (!overlay.value || !id) return;
  if (region === null) {
    await overlay.value.hideHighlight();
    return;
  }
  await overlay.value.highlightNode(id);
}

function isRegion(r: Region) {
  return hoveredRegion.value === r;
}
</script>

<template>
  <div class="h-full overflow-auto px-3 py-3">
    <div v-if="!boxModel" class="text-xs text-muted-foreground/40 text-center py-6">
      Select an element to see the box model
    </div>

    <div v-else class="text-[10px] font-mono select-none mx-auto max-w-[320px]">
      <div class="flex justify-center gap-2 mb-2 text-muted-foreground/60">
        <span><span class="text-muted-foreground/40">position:</span> {{ position }}</span>
        <span><span class="text-muted-foreground/40">display:</span> {{ display }}</span>
      </div>

      <div
        class="border border-orange-400/30 rounded relative text-center pt-1 pb-2 px-2 transition-colors"
        :class="isRegion('margin') ? 'bg-orange-400/20' : 'bg-orange-400/5'"
        @mouseenter="highlight('margin')"
        @mouseleave="highlight(null)"
      >
        <div class="absolute top-0 left-1 text-orange-300/70 text-[9px] tracking-wide">margin</div>
        <div class="text-orange-200/80 mt-2">{{ margin.top }}</div>
        <div class="flex items-center my-0.5">
          <div class="text-orange-200/80 w-9 text-right pr-1">{{ margin.left }}</div>

          <div
            class="flex-1 border border-yellow-400/30 rounded relative text-center pt-1 pb-2 px-1 transition-colors"
            :class="isRegion('border') ? 'bg-yellow-400/25' : 'bg-yellow-400/5'"
            @mouseenter.stop="highlight('border')"
            @mouseleave.stop="highlight('margin')"
          >
            <div class="absolute top-0 left-1 text-yellow-300/70 text-[9px] tracking-wide">
              border
            </div>
            <div class="text-yellow-200/80 mt-2">{{ border.top }}</div>
            <div class="flex items-center my-0.5">
              <div class="text-yellow-200/80 w-7 text-right pr-1">{{ border.left }}</div>

              <div
                class="flex-1 border border-green-400/30 rounded relative text-center pt-1 pb-2 px-1 transition-colors"
                :class="isRegion('padding') ? 'bg-green-400/25' : 'bg-green-400/5'"
                @mouseenter.stop="highlight('padding')"
                @mouseleave.stop="highlight('border')"
              >
                <div class="absolute top-0 left-1 text-green-300/70 text-[9px] tracking-wide">
                  padding
                </div>
                <div class="text-green-200/80 mt-2">{{ padding.top }}</div>
                <div class="flex items-center my-0.5">
                  <div class="text-green-200/80 w-7 text-right pr-1">{{ padding.left }}</div>

                  <div
                    class="flex-1 border border-blue-400/30 rounded py-2 text-center transition-colors"
                    :class="
                      isRegion('content')
                        ? 'bg-blue-400/30 text-blue-100'
                        : 'bg-blue-400/10 text-blue-200/90'
                    "
                    @mouseenter.stop="highlight('content')"
                    @mouseleave.stop="highlight('padding')"
                  >
                    {{ content.width }} × {{ content.height }}
                  </div>

                  <div class="text-green-200/80 w-7 text-left pl-1">{{ padding.right }}</div>
                </div>
                <div class="text-green-200/80">{{ padding.bottom }}</div>
              </div>

              <div class="text-yellow-200/80 w-7 text-left pl-1">{{ border.right }}</div>
            </div>
            <div class="text-yellow-200/80">{{ border.bottom }}</div>
          </div>

          <div class="text-orange-200/80 w-9 text-left pl-1">{{ margin.right }}</div>
        </div>
        <div class="text-orange-200/80">{{ margin.bottom }}</div>
      </div>

      <div class="flex justify-between text-[9px] mt-3 px-1 text-muted-foreground/60">
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 bg-orange-400/40 rounded-sm" />margin
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 bg-yellow-400/40 rounded-sm" />border
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 bg-green-400/40 rounded-sm" />padding
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 bg-blue-400/40 rounded-sm" />content
        </span>
      </div>
    </div>
  </div>
</template>
