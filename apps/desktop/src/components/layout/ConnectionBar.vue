<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { ChevronDown, Circle, Signal, Cpu } from "lucide-vue-next";
import DeviceManagerModal from "@/components/DeviceManagerModal.vue";

const emit = defineEmits<{ openCommandPalette: [] }>();

const clock = ref("");
const deviceModalOpen = ref(false);
const activeDevice = ref({ model: "Galaxy S23", id: "R5CR30LHXXY" });

function updateClock() {
  const now = new Date();
  clock.value = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  updateClock();
  timer = setInterval(updateClock, 1000);
});
onUnmounted(() => clearInterval(timer));

function onSelectDevice(id: string) {
  const map: Record<string, string> = {
    R5CR30LHXXY: "Galaxy S23",
    emulator_5554: "Pixel 7 Emulator",
    "8XH3R9K21B": "Huawei P30 Pro",
  };
  activeDevice.value = { model: map[id] ?? id, id };
}
</script>

<template>
  <header class="h-10 bg-background flex items-center px-4 gap-5 shrink-0 border-b border-border">
    <div class="w-px h-4 bg-border" />

    <!-- CDP target -->
    <div class="flex items-center gap-2 text-xs">
      <Signal class="w-3 h-3 text-foreground" />
      <span class="text-secondary-foreground">CDP</span>
      <span class="text-muted-foreground font-mono text-2xs">localhost:9222</span>
    </div>

    <div class="w-px h-4 bg-border" />

    <!-- Origin -->
    <div class="flex items-center gap-2 text-xs">
      <Cpu class="w-3 h-3 text-muted-foreground" />
      <span class="font-mono text-secondary-foreground text-2xs">my-ionic-app.com</span>
    </div>

    <div class="flex-1" />

    <!-- Clock + shortcut -->
    <div class="flex items-center gap-3 text-2xs text-muted-foreground">
      <span class="font-mono">{{ clock }}</span>
      <button
        @click="emit('openCommandPalette')"
        class="px-1.5 py-0.5 rounded bg-secondary border border-border text-2xs text-muted-foreground hover:text-foreground/60 transition-colors"
      >
        ⌘K
      </button>
    </div>
  </header>

  <DeviceManagerModal
    :open="deviceModalOpen"
    @close="deviceModalOpen = false"
    @select-device="onSelectDevice"
  />
</template>
