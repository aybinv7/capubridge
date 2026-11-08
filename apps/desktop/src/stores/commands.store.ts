import { computed, ref, shallowRef } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { toast } from "@/lib/toast";
import type { Command } from "@/lib/commands/types";
import { resolveKeydown, type SequenceState } from "@/lib/commands/dispatch";
import { isEditableTarget } from "@/lib/commands/editable";
import { readPersisted, writePersisted } from "@/lib/persisted";
import {
  MAX_RECENT_APPS,
  MAX_RECENT_COMMANDS,
  isStringArray,
  pushRecent,
} from "@/lib/commands/recents";

const LS_RECENT = "capubridge:recent-commands";
const LS_RECENT_APPS = "capubridge:recent-apps";

export type CommandProvider = () => readonly Command[];

export const useCommandsStore = defineStore("commands", () => {
  const providers = shallowRef(new Map<string, CommandProvider>());
  const paletteOpen = ref(false);
  const paletteQuery = ref("");
  const recentIds = ref<string[]>(readPersisted<string[]>(LS_RECENT, [], isStringArray));
  const recentApps = ref<string[]>(readPersisted<string[]>(LS_RECENT_APPS, [], isStringArray));
  let pendingSequence: SequenceState | null = null;

  /**
   * Every provider's commands. When two providers offer the same id the one registered later
   * wins and keeps the earlier one's place, so a screen can specialise an app-wide command.
   */
  const commands = computed<Command[]>(() => {
    const byId = new Map<string, Command>();
    for (const provider of providers.value.values()) {
      for (const command of provider()) byId.set(command.id, command);
    }
    return [...byId.values()];
  });

  const available = computed(() => commands.value.filter((command) => command.when?.() ?? true));

  const bindings = computed(() => {
    const map = new Map<string, string>();
    for (const command of commands.value) {
      if (command.binding) map.set(command.id, command.binding);
    }
    return map;
  });

  /** The registered binding of a command, so no surface hand-writes a key label. */
  function bindingOf(id: string): string | null {
    return bindings.value.get(id) ?? null;
  }

  const recent = computed(() => {
    const byId = new Map(available.value.map((command) => [command.id, command]));
    return recentIds.value
      .map((id) => byId.get(id))
      .filter((command): command is Command => command !== undefined);
  });

  function registerProvider(id: string, provider: CommandProvider): () => void {
    const next = new Map(providers.value);
    next.set(id, provider);
    providers.value = next;
    return () => {
      if (providers.value.get(id) !== provider) return;
      const remaining = new Map(providers.value);
      remaining.delete(id);
      providers.value = remaining;
    };
  }

  function remember(id: string) {
    if (id === "view.palette") return;
    recentIds.value = pushRecent(recentIds.value, id, MAX_RECENT_COMMANDS);
    writePersisted(LS_RECENT, recentIds.value);
  }

  /** Remembers an app opened from the palette, so "open" lists it first next time. */
  function rememberApp(packageName: string) {
    recentApps.value = pushRecent(recentApps.value, packageName, MAX_RECENT_APPS);
    writePersisted(LS_RECENT_APPS, recentApps.value);
  }

  async function run(command: Command) {
    remember(command.id);
    try {
      await command.run();
    } catch (error) {
      console.error(`Command ${command.id} failed`, error);
      toast.error(`${command.title} failed`, { description: String(error) });
    }
  }

  function openPalette(query = "") {
    paletteQuery.value = query;
    paletteOpen.value = true;
  }

  function closePalette() {
    paletteOpen.value = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    const result = resolveKeydown(
      commands.value,
      event,
      isEditableTarget(event.target),
      pendingSequence,
      performance.now(),
    );
    pendingSequence = result.sequence;
    if (result.command) {
      event.preventDefault();
      void run(result.command);
    }
  }

  return {
    commands,
    available,
    recent,
    recentApps,
    paletteOpen,
    paletteQuery,
    registerProvider,
    rememberApp,
    bindingOf,
    run,
    openPalette,
    closePalette,
    handleKeydown,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCommandsStore, import.meta.hot));
}
