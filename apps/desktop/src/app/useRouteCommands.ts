import { onUnmounted, type Component } from "vue";
import { useRouter } from "vue-router";
import { commandPaletteFeatures, isRouteEnabled } from "@/app/feature-registry";
import { deriveRouteEntries } from "@/lib/commands/routeEntries";
import { gateNote } from "@/lib/gates/note";
import type { Command } from "@/lib/commands/types";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useCommandsStore } from "@/stores/commands.store";

/**
 * Offers every child route of the enabled features as a destination ("Data › SQLite"), read from
 * the routes themselves so a new tab shows up with no list to edit. Each says quietly what its
 * screen still needs when it would open a gate.
 */
export function useRouteCommands(): void {
  const router = useRouter();
  const commands = useCommandsStore();
  const context = useActiveContextStore();

  const icons = new Map<string, Component>(
    commandPaletteFeatures.map((feature) => [feature.id, feature.icon]),
  );
  const entries = deriveRouteEntries(commandPaletteFeatures, (route) => isRouteEnabled(route));
  const list = entries.map<Command>((entry) => ({
    id: entry.id,
    title: entry.title,
    group: "Navigate",
    icon: icons.get(entry.featureId),
    keywords: entry.keywords,
    note: () => gateNote(entry.requires, context.gateInput),
    run: () => router.push(entry.path),
  }));

  const dispose = commands.registerProvider("core.routes", () => list);
  onUnmounted(dispose);
}
