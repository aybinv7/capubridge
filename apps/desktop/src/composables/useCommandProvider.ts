import { onUnmounted } from "vue";
import { useCommandsStore, type CommandProvider } from "@/stores/commands.store";

/** Registers commands for as long as the calling component is mounted. */
export function useCommandProvider(id: string, provider: CommandProvider): void {
  const commands = useCommandsStore();
  const dispose = commands.registerProvider(id, provider);
  onUnmounted(dispose);
}
