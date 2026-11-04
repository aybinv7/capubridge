import { computed, ref, shallowRef } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { toast } from "vue-sonner";
import type { Command } from "@/lib/commands/types";
import { resolveKeydown, type SequenceState } from "@/lib/commands/dispatch";
import { isEditableTarget } from "@/lib/commands/editable";
import { readPersisted, writePersisted } from "@/lib/persisted";

const LS_RECENT = "capubridge:recent-commands";
const MAX_RECENT = 6;

export type CommandProvider = () => readonly Command[];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export const useCommandsStore = defineStore("commands", () => {
  const providers = shallowRef(new Map<string, CommandProvider>());
  const paletteOpen = ref(false);
  const paletteQuery = ref("");
  const recentIds = ref<string[]>(readPersisted<string[]>(LS_RECENT, [], isStringArray));
  let pendingSequence: SequenceState | null = null;

  const commands = computed<Command[]>(() => {
    const result: Command[] = [];
    const seen = new Set<string>();
    for (const provider of providers.value.values()) {
      for (const command of provider()) {
        if (seen.has(command.id)) continue;
        seen.add(command.id);
        result.push(command);
      }
    }
    return result;
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

  const recent = computed(() =>
    recentIds.value
      .map((id) => available.value.find((command) => command.id === id))
      .filter((command): command is Command => command !== undefined),
  );

  function registerProvider(id: string, provider: CommandProvider): () => void {
    const next = new Map(providers.value);
    next.set(id, provider);
    providers.value = next;
    return () => {
      const remaining = new Map(providers.value);
      remaining.delete(id);
      providers.value = remaining;
    };
  }

  function remember(id: string) {
    if (id === "view.palette") return;
    recentIds.value = [id, ...recentIds.value.filter((entry) => entry !== id)].slice(0, MAX_RECENT);
    writePersisted(LS_RECENT, recentIds.value);
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
    paletteOpen,
    paletteQuery,
    registerProvider,
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
