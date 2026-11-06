/**
 * Compatibility for the Artemis agent, which was removed from Capubridge in
 * favour of Jev. Flows, runs and tasks saved before the removal still name it,
 * so readers recognise the id; nothing can start, save or hand off to it.
 */
export const REMOVED_ARTEMIS_ID = "artemis";

/** How saved runs and tasks that Artemis drove are labelled. */
export const REMOVED_ARTEMIS_LABEL = "Artemis (removed)";

/** Why a request naming Artemis is refused, and what to use instead. */
export const REMOVED_ARTEMIS_MESSAGE =
  'The Artemis policy was removed from Capubridge. Use "jev" (the AI agent) or "rules" (replays a saved flow).';

/**
 * Reports whether a stored policy, owner or origin value names the removed
 * Artemis agent.
 */
export function isRemovedArtemis(value: unknown): value is typeof REMOVED_ARTEMIS_ID {
  return value === REMOVED_ARTEMIS_ID;
}
