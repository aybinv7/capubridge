import { inject, provide, type InjectionKey, type Ref } from "vue";
import { useAppLifecycle, type AppLifecycle } from "./lifecycle/useAppLifecycle";
import { usePackageDump } from "./package/usePackageDump";
import { createAppProcess, type AppProcess } from "./process/useAppProcess";
import { useProcessPhase } from "./process/useProcessPhase";
import { createInspectedApp, type InspectedApp } from "./subject/useInspectedApp";

export interface AppSession {
  app: InspectedApp;
  process: AppProcess;
  phase: ReturnType<typeof useProcessPhase>;
  dump: ReturnType<typeof usePackageDump>;
  lifecycle: AppLifecycle;
}

const APP_SESSION: InjectionKey<AppSession> = Symbol("app-session");

/**
 * Creates the App route's state once, above the gate, so moving between its tabs keeps the
 * readings; everything in it follows the selected app and starts over when it changes.
 */
export function provideAppSession(processWanted: Readonly<Ref<boolean>>): AppSession {
  const app = createInspectedApp();
  const process = createAppProcess(app.subject, processWanted);
  const phase = useProcessPhase(process, app.presence);
  const dump = usePackageDump(app.subject);
  const lifecycle = useAppLifecycle(app, process);
  const session = { app, process, phase, dump, lifecycle };
  provide(APP_SESSION, session);
  return session;
}

/** The App route's shared state; only valid under `AppPanel`. */
export function useAppSession(): AppSession {
  const session = inject(APP_SESSION, null);
  if (!session) throw new Error("useAppSession() needs provideAppSession() in AppPanel");
  return session;
}
