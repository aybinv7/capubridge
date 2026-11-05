/** What a destructive or disruptive device action asks before it runs. */
export interface ConfirmRequest {
  title: string;
  text: string;
  confirmLabel: string;
  danger: boolean;
}
