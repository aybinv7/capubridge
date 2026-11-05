/** What a destructive or disruptive device action asks before it runs. */
export interface DeviceConfirmRequest {
  title: string;
  text: string;
  confirmLabel: string;
  danger: boolean;
}
