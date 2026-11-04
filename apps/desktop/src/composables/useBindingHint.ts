import { useCommandsStore } from "@/stores/commands.store";
import { bindingLabel, bindingTokens } from "@/lib/commands/keymap";

/** Key hints read from the command registry, so a rebinding updates every tooltip and key cap. */
export function useBindingHint() {
  const commands = useCommandsStore();

  /** `"Toggle dock (Ctrl+J)"`, or just the label when the command has no binding. */
  function hint(label: string, commandId: string): string {
    const binding = commands.bindingOf(commandId);
    return binding ? `${label} (${bindingLabel(binding)})` : label;
  }

  /** Cladd `Shortcut` tokens for a command, or `null` when it has no binding. */
  function keysOf(commandId: string): string | null {
    const binding = commands.bindingOf(commandId);
    return binding ? bindingTokens(binding) : null;
  }

  /** Plain-text binding for prose, or `null`. */
  function labelOf(commandId: string): string | null {
    const binding = commands.bindingOf(commandId);
    return binding ? bindingLabel(binding) : null;
  }

  return { hint, keysOf, labelOf };
}
