import type { Command } from "./types";
import { matchesChord, normalizeKey, parseBinding, type ParsedBinding } from "./keymap";

export const SEQUENCE_TIMEOUT_MS = 1200;

export interface SequenceState {
  key: string;
  at: number;
}

const parsedCache = new Map<string, ParsedBinding>();

function parsed(binding: string): ParsedBinding {
  let value = parsedCache.get(binding);
  if (!value) {
    value = parseBinding(binding);
    parsedCache.set(binding, value);
  }
  return value;
}

export interface DispatchResult {
  command: Command | null;
  sequence: SequenceState | null;
}

/**
 * Pure keymap resolution: given the commands, the event, whether the focus is in an editable
 * field and the pending sequence, returns the command to run (if any) and the next sequence state.
 */
export function resolveKeydown(
  commands: readonly Command[],
  event: KeyboardEvent,
  editable: boolean,
  pending: SequenceState | null,
  now: number,
): DispatchResult {
  const bound = commands.filter((command) => command.binding && (command.when?.() ?? true));

  for (const command of bound) {
    const binding = parsed(command.binding as string);
    if (binding.kind !== "chord") continue;
    if (editable && !command.global) continue;
    if (matchesChord(binding.chord, event)) {
      return { command, sequence: null };
    }
  }

  if (editable || event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
    return { command: null, sequence: pending };
  }

  const key = normalizeKey(event);
  if (key.length !== 1) return { command: null, sequence: pending };

  if (pending && now - pending.at <= SEQUENCE_TIMEOUT_MS) {
    const match = bound.find((command) => {
      const binding = parsed(command.binding as string);
      return (
        binding.kind === "sequence" && binding.keys[0] === pending.key && binding.keys[1] === key
      );
    });
    if (match) return { command: match, sequence: null };
  }

  const startsSequence = bound.some((command) => {
    const binding = parsed(command.binding as string);
    return binding.kind === "sequence" && binding.keys[0] === key;
  });
  return { command: null, sequence: startsSequence ? { key, at: now } : null };
}
