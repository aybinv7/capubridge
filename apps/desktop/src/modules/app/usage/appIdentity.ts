/** The app's Android user and app id, which together name its Linux uid. */
export interface AppIdentity {
  user: number;
  appId: number;
}

/** The Linux uid of an app for one Android user (user 10 runs app 10406 as 1010406). */
export function appUid(identity: AppIdentity): number {
  return identity.user * 100_000 + identity.appId;
}
