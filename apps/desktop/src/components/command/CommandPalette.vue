<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  ListboxContent,
  ListboxFilter,
  ListboxGroup,
  ListboxGroupLabel,
  ListboxItem,
  ListboxRoot,
} from "reka-ui";
import { Search } from "lucide-vue-next";
import { useCommandsStore } from "@/stores/commands.store";
import { rankByScore } from "@/lib/commands/fuzzy";
import { bindingTokens } from "@/lib/commands/keymap";
import type { Command, CommandGroup } from "@/lib/commands/types";
import KeyCaps from "./KeyCaps.vue";

const commands = useCommandsStore();

const GROUP_ORDER: CommandGroup[] = [
  "Recent",
  "Targets",
  "Devices",
  "Navigate",
  "Data",
  "Network",
  "Session",
  "View",
  "Appearance",
  "Help",
];

type Scope = "all" | "commands" | "context" | "screen";

const open = computed({
  get: () => commands.paletteOpen,
  set: (value: boolean) => {
    if (!value) commands.closePalette();
  },
});

const query = ref("");
const highlighted = ref<string | undefined>(undefined);

watch(
  () => commands.paletteOpen,
  async (isOpen) => {
    if (!isOpen) return;
    query.value = commands.paletteQuery;
    await nextTick();
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>("[data-palette-input]");
      if (!input) return;
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  },
);

const scope = computed<Scope>(() => {
  if (query.value.startsWith(">")) return "commands";
  if (query.value.startsWith("@")) return "context";
  if (query.value.startsWith(":")) return "screen";
  return "all";
});

const searchText = computed(() =>
  scope.value === "all" ? query.value : query.value.slice(1).trimStart(),
);

function inScope(command: Command): boolean {
  if (scope.value === "screen") return command.screen === true;
  if (scope.value === "context") return command.group === "Devices" || command.group === "Targets";
  if (scope.value === "commands") return command.group !== "Devices" && command.group !== "Targets";
  return true;
}

function searchable(command: Command): string[] {
  return [command.title, command.detail ?? "", ...(command.keywords ?? [])];
}

const groups = computed(() => {
  const candidates = commands.available.filter(
    (command) => inScope(command) && (!command.dormant || searchText.value.length > 0),
  );
  const ranked = rankByScore(candidates, searchText.value, searchable);
  const buckets = new Map<CommandGroup, Command[]>();

  if (!searchText.value && scope.value === "all") {
    const recent = commands.recent.filter(inScope);
    if (recent.length > 0) buckets.set("Recent", recent);
  }

  const shownInRecent = new Set((buckets.get("Recent") ?? []).map((command) => command.id));
  for (const command of ranked) {
    if (shownInRecent.has(command.id)) continue;
    const bucket = buckets.get(command.group) ?? [];
    bucket.push(command);
    buckets.set(command.group, bucket);
  }

  if (searchText.value) {
    const best = ranked[0];
    const order = best ? [best.group, ...GROUP_ORDER.filter((g) => g !== best.group)] : GROUP_ORDER;
    return order
      .filter((g) => buckets.has(g))
      .map((g) => ({ group: g, items: buckets.get(g) ?? [] }));
  }
  return GROUP_ORDER.filter((g) => buckets.has(g)).map((g) => ({
    group: g,
    items: buckets.get(g) ?? [],
  }));
});

const flatIds = computed(() => groups.value.flatMap((entry) => entry.items.map((item) => item.id)));

watch(
  flatIds,
  (ids) => {
    if (!highlighted.value || !ids.includes(highlighted.value)) highlighted.value = ids[0];
  },
  { immediate: true },
);

const byId = computed(() => new Map(commands.available.map((command) => [command.id, command])));

function select(id: unknown) {
  if (typeof id !== "string") return;
  const command = byId.value.get(id);
  if (!command) return;
  commands.closePalette();
  void commands.run(command);
}

const scopeLabel = computed(() => {
  if (scope.value === "commands") return "commands";
  if (scope.value === "screen") return "this screen";
  return "devices & targets";
});

const placeholder = computed(() => {
  if (scope.value === "context") return "Switch device or target…";
  if (scope.value === "commands") return "Run a command…";
  if (scope.value === "screen") return "Actions on this screen…";
  return "Search commands, devices, targets…";
});
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-[var(--bg-overlay)] data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogContent
        class="fixed left-1/2 top-[16vh] z-50 flex w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-lg bg-[var(--bg-surface-raised)] shadow-[var(--bevel-strong),var(--shadow-float)] focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        :aria-describedby="undefined"
      >
        <DialogTitle class="sr-only">Command palette</DialogTitle>
        <DialogDescription class="sr-only">
          Type to search. Use &gt; for commands and @ for devices and targets.
        </DialogDescription>

        <ListboxRoot
          v-model:highlighted="highlighted"
          highlight-on-hover
          class="flex min-h-0 flex-col"
          @update:model-value="select"
        >
          <div class="flex h-11 items-center gap-2.5 border-b border-[var(--border-subtle)] px-3.5">
            <Search :size="15" class="shrink-0 text-muted-foreground" />
            <ListboxFilter
              v-model="query"
              data-palette-input
              auto-focus
              :placeholder="placeholder"
              class="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-[var(--fg-subtle)]"
            />
            <span
              v-if="scope !== 'all'"
              class="rounded-sm bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-2xs text-signal-select"
            >
              {{ scopeLabel }}
            </span>
          </div>

          <ListboxContent class="max-h-[420px] overflow-y-auto p-1.5">
            <ListboxGroup v-for="entry in groups" :key="entry.group" class="mb-1 last:mb-0">
              <ListboxGroupLabel
                class="px-2.5 pb-1 pt-2 text-2xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]"
              >
                {{ entry.group }}
              </ListboxGroupLabel>
              <ListboxItem
                v-for="command in entry.items"
                :key="command.id"
                :value="command.id"
                class="flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-sm text-foreground outline-none data-[highlighted]:bg-[var(--bg-surface)] data-[highlighted]:shadow-bevel"
              >
                <component
                  :is="command.icon"
                  v-if="command.icon"
                  :size="15"
                  class="shrink-0 text-muted-foreground"
                />
                <span class="truncate">{{ command.title }}</span>
                <span
                  v-if="command.detail"
                  class="min-w-0 flex-1 truncate font-mono text-2xs text-[var(--fg-subtle)]"
                >
                  {{ command.detail }}
                </span>
                <span v-else class="flex-1" />
                <KeyCaps v-if="command.binding" :keys="bindingTokens(command.binding)" />
              </ListboxItem>
            </ListboxGroup>

            <div
              v-if="groups.length === 0"
              class="flex flex-col items-center gap-1 px-4 py-10 text-center"
            >
              <p v-if="scope === 'screen' && !searchText" class="text-sm text-foreground">
                This screen has no actions yet
              </p>
              <p v-else class="text-sm text-foreground">No matches for “{{ searchText }}”</p>
              <p class="text-xs text-muted-foreground">
                Try a device serial, a page title, or start with &gt; for commands.
              </p>
            </div>
          </ListboxContent>

          <div
            class="flex h-8 items-center gap-4 border-t border-[var(--border-subtle)] px-3.5 text-2xs text-muted-foreground"
          >
            <span class="flex items-center gap-1.5"><KeyCaps keys="up down" /> navigate</span>
            <span class="flex items-center gap-1.5"><KeyCaps keys="enter" /> run</span>
            <span class="flex items-center gap-1.5"><KeyCaps keys="esc" /> close</span>
            <span class="flex-1" />
            <span><span class="font-mono text-foreground">&gt;</span> commands</span>
            <span><span class="font-mono text-foreground">@</span> devices &amp; targets</span>
            <span><span class="font-mono text-foreground">:</span> this screen</span>
          </div>
        </ListboxRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
