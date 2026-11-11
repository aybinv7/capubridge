<script setup lang="ts">
import { computed } from "vue";
import { ArrowUpRight } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { useAppPackages } from "@/composables/useAppPackages";
import { useGateActions } from "@/composables/useGateActions";
import { targetAppName } from "@/lib/target-app-name";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";

/**
 * The one "Bring to front" in the app, in the title bar where it is always seen: while the picked
 * app is in the background on the phone, Android may freeze it and nothing can read from it, and
 * the phone's screen shows whatever is in front instead.
 */
const context = useActiveContextStore();
const presence = useTargetPresenceStore();
const gate = useGateActions();

const serial = computed(() => context.device?.serial ?? "");
const { getCachedPackage } = useAppPackages(serial);

const app = computed(() => {
  const target = context.target;
  if (target?.source !== "adb" || !target.packageName) return null;
  if (presence.presence !== "background") return null;
  return targetAppName(target, getCachedPackage(target.packageName)?.label) ?? target.packageName;
});

const busy = computed(() => gate.running.value === "bring-to-front");

function bringToFront() {
  void gate.run("bring-to-front", "Bring app to front");
}
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,translate] duration-300 ease-cladd-settle motion-reduce:transition-none"
    leave-active-class="transition-[opacity,translate] duration-150 ease-in motion-reduce:transition-none"
    enter-from-class="-translate-x-1 opacity-0"
    leave-to-class="-translate-x-1 opacity-0"
  >
    <Button
      v-if="app"
      variant="solid"
      surface-level="1"
      class="h-7.5 border border-border text-xs font-normal"
      style="-webkit-app-region: no-drag"
      content-class-name="gap-1.5 pr-3 pl-2.5 [&>svg]:size-3.5"
      :loading="busy"
      :title="`${app} is in the background, so the phone shows another app and cannot answer`"
      :aria-label="`Bring ${app} to the front`"
      @click="bringToFront"
    >
      <span class="size-1.5 shrink-0 rounded-full bg-signal-mark" aria-hidden="true" />
      <ArrowUpRight :stroke-width="1.8" class="text-muted-foreground" />
      <span class="hidden max-w-40 truncate text-foreground @[900px]/titlebar:inline">
        Bring {{ app }} to front
      </span>
      <span class="text-foreground @[900px]/titlebar:hidden">To front</span>
    </Button>
  </Transition>
</template>
