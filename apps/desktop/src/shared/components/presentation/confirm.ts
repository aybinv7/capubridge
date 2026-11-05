/** What a destructive or disruptive device action asks before it runs. */
export interface ConfirmRequest {
  title: string;
  text: string;
  confirmLabel: string;
  danger: boolean;
  /** Lines listed under the text (each value a replace would lose, for example). */
  details?: readonly string[];
  /** The person must type this exact text before the action can run. */
  requireConfirmText?: string;
}

/** How many `details` lines a confirmation shows before it says how many more there are. */
export const CONFIRM_DETAILS_SHOWN = 40;
