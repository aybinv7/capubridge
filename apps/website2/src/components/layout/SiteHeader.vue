<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import ThreadButton from "@/components/ui/ThreadButton.vue";
import GitHubIcon from "@/components/ui/GitHubIcon.vue";
import { navLinks, REPO_URL } from "@/data/site";

const scrolled = ref(false);
const menuOpen = ref(false);

const onScroll = () => {
  scrolled.value = window.scrollY > 24;
};

const setMenu = (next: boolean) => {
  menuOpen.value = next;
};

const toggleMenu = () => setMenu(!menuOpen.value);
const closeMenu = () => setMenu(false);

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") closeMenu();
};

onMounted(() => {
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("keydown", onKeydown);
  document.body.style.removeProperty("overflow");
});

watch(menuOpen, (open) => {
  document.body.style.overflow = open ? "hidden" : "";
});
</script>

<template>
  <header class="fixed inset-x-0 top-0 z-[1200] transition-colors duration-300">
    <div class="mx-auto flex h-14 max-w-[1360px] items-center gap-3 px-5 md:gap-6 md:px-8">
      <a href="#top" class="flex items-center gap-2.5">
        <img
          src="/icon-64.webp"
          srcset="/icon-64.webp 64w, /icon-128.webp 128w"
          sizes="24px"
          alt=""
          class="h-6 w-6 object-contain"
          width="24"
          height="24"
        />
        <span class="font-[var(--font-display)] text-[15px] font-semibold tracking-[-0.01em]">
          Capubridge
        </span>
      </a>

      <div class="ml-auto flex items-center gap-2">
        <a
          :href="REPO_URL"
          target="_blank"
          rel="noopener"
          aria-label="Capubridge on GitHub"
          class="flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink-2)] transition-colors duration-150 hover:text-[var(--ink-0)]"
        >
          <GitHubIcon class="h-[18px] w-[18px]" />
        </a>
        <ThreadButton href="#download" class="hidden! lg:block! !px-3.5 !py-1.5 !text-[13px]">
          Download
        </ThreadButton>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--rule-strong)] text-[var(--ink-1)] transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] md:hidden"
          :aria-expanded="menuOpen"
          aria-controls="mobile-nav"
          :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
          @click="toggleMenu"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
    </div>
  </header>

  <Teleport to="body">
    <Transition name="drop">
      <div
        v-if="menuOpen"
        id="mobile-nav"
        class="mobile-overlay fixed inset-0 z-[1300] flex flex-col bg-[var(--background)]/92 backdrop-blur-2xl md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
      >
        <div class="flex h-14 shrink-0 items-center justify-between px-5">
          <a href="#top" class="flex items-center gap-2.5" @click="closeMenu">
            <img
              src="/icon-64.webp"
              srcset="/icon-64.webp 64w, /icon-128.webp 128w"
              sizes="24px"
              alt=""
              class="h-6 w-6 object-contain"
              width="24"
              height="24"
            />
            <span class="font-[var(--font-display)] text-[15px] font-semibold tracking-[-0.01em]">
              Capubridge
            </span>
          </a>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--rule-strong)] text-[var(--ink-1)] transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            aria-label="Close menu"
            @click="closeMenu"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav class="flex flex-1 flex-col justify-center gap-0 overflow-y-auto px-6">
          <a
            v-for="link in navLinks"
            :key="link.href"
            :href="link.href"
            class="menu-link group flex items-center justify-between border-b border-[var(--rule)] py-5"
            @click="closeMenu"
          >
            <span
              class="font-[var(--font-display)] text-[30px] font-semibold tracking-[-0.02em] text-[var(--ink-0)] sm:text-[36px]"
            >
              {{ link.label }}
            </span>
            <svg
              viewBox="0 0 24 24"
              class="tilt-arrow h-6 w-6 shrink-0 text-[var(--ink-3)] transition-all duration-300 group-hover:text-[var(--accent)]"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </nav>

        <div
          class="flex shrink-0 items-center justify-between border-t border-[var(--rule)] px-6 py-6"
        >
          <a
            :href="REPO_URL"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-2 text-[13px] text-[var(--ink-2)]"
            @click="closeMenu"
          >
            <GitHubIcon class="h-[18px] w-[18px]" />
            GitHub
          </a>
          <ThreadButton href="#download" variant="primary" @click="closeMenu">
            Download
          </ThreadButton>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tilt-arrow {
  transform: rotate(-16deg);
}

.menu-link:hover .tilt-arrow,
.menu-link:focus-visible .tilt-arrow {
  transform: rotate(0deg) scale(1.1);
}

/*
 * Unfurls downward from the header, like a blind dropping - transform and
 * opacity only, so it stays on the compositor and never touches layout.
 */
.drop-enter-active {
  transition:
    transform 340ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}

.drop-leave-active {
  transition:
    transform 240ms cubic-bezier(0.4, 0, 1, 1),
    opacity 200ms ease;
}

.drop-enter-from,
.drop-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.drop-enter-to,
.drop-leave-from {
  transform: translateY(0);
  opacity: 1;
}
</style>
