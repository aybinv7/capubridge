import type { TimelineMarkerRef } from "@/types/timeline.types";

/** What a section does when the timeline asks it to show a marker's evidence. */
export interface RevealHandler {
  /** Navigates to the evidence and highlights it; false when it is no longer kept. */
  reveal(ref: TimelineMarkerRef): boolean | Promise<boolean>;
  /** Whether the evidence is still kept, for an "aged out" label before any navigation. */
  isKept?(ref: TimelineMarkerRef): boolean;
  /** How much the section keeps, said plainly: "Console keeps the last 10,000 messages". */
  keeps?: string;
}

export type RevealOutcome = "revealed" | "aged-out" | "no-handler";

const handlers = new Map<TimelineMarkerRef["kind"], RevealHandler>();

/**
 * Registers the section that owns markers of `kind` (one per kind; a later registration
 * replaces the earlier one). Returns a function that unregisters it, only if still current.
 * Sections register from their own entry points, so the timeline never imports a module.
 */
export function registerReveal(kind: TimelineMarkerRef["kind"], handler: RevealHandler) {
  handlers.set(kind, handler);
  return () => {
    if (handlers.get(kind) === handler) {
      handlers.delete(kind);
    }
  };
}

/** Asks the owning section to show the evidence behind `ref`. */
export async function revealMarker(ref: TimelineMarkerRef): Promise<RevealOutcome> {
  const handler = handlers.get(ref.kind);
  if (!handler) {
    return "no-handler";
  }
  return (await handler.reveal(ref)) ? "revealed" : "aged-out";
}

/** Whether the evidence behind `ref` is still kept; unknown kinds count as not kept. */
export function isMarkerKept(ref: TimelineMarkerRef): boolean {
  const handler = handlers.get(ref.kind);
  return handler?.isKept ? handler.isKept(ref) : handler !== undefined;
}

/** Whether a section has registered to show markers of `kind`. */
export function hasReveal(kind: TimelineMarkerRef["kind"]): boolean {
  return handlers.has(kind);
}

/** What the owning section says it keeps, for an aged-out item; null when it does not say. */
export function retentionOf(kind: TimelineMarkerRef["kind"]): string | null {
  return handlers.get(kind)?.keeps ?? null;
}
