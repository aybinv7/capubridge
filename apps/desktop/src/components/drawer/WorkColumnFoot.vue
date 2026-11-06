<script setup lang="ts">
import { computed, ref } from "vue";
import { useDrawerStore } from "@/stores/drawer.store";
import ConsoleDrawer from "./ConsoleDrawer.vue";
import { useDrawerPopout } from "./useDrawerPopout";

/**
 * The foot of the page: the console drawer, its own card inside the page. Maximised, it takes
 * the whole column. Pop-outs are managed here, so a view can come back even after the drawer
 * closed. The timeline strip lives outside the page, on the window background.
 */
const emit = defineEmits<{ requestMainFocus: [] }>();

const drawer = useDrawerStore();
const { popOut } = useDrawerPopout();
const consoleDrawer = ref<InstanceType<typeof ConsoleDrawer> | null>(null);

const fills = computed(() => drawer.isOpen && drawer.maximized);

defineExpose({
  focusDrawer() {
    consoleDrawer.value?.focus();
  },
});
</script>

<template>
  <div
    class="flex flex-col"
    :class="[fills ? 'min-h-0 flex-1' : 'shrink-0', drawer.isOpen ? 'px-1.5 pt-1.5 pb-1.5' : '']"
  >
    <Transition
      enter-active-class="transition-[grid-template-rows,opacity] duration-500 ease-cladd-settle motion-reduce:transition-none"
      enter-from-class="reveal-from grid-rows-[0fr] opacity-0"
      enter-to-class="grid-rows-[1fr] opacity-100"
      leave-active-class="transition-[grid-template-rows,opacity] duration-200 ease-in motion-reduce:transition-none"
      leave-from-class="grid-rows-[1fr] opacity-100"
      leave-to-class="reveal-to grid-rows-[0fr] opacity-0"
    >
      <div
        v-if="drawer.isOpen"
        class="group/reveal grid grid-rows-[1fr]"
        :class="fills ? 'min-h-0 flex-1' : 'shrink-0'"
      >
        <div class="flex min-h-0 flex-col overflow-hidden">
          <ConsoleDrawer
            ref="consoleDrawer"
            class="origin-bottom transition-[translate,scale] duration-500 ease-cladd-spring group-[.reveal-from]/reveal:translate-y-10 group-[.reveal-from]/reveal:scale-x-[0.97] group-[.reveal-to]/reveal:translate-y-6 motion-reduce:transition-none"
            @popout="popOut"
            @request-main-focus="emit('requestMainFocus')"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
