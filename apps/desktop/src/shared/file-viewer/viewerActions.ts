/** Whether the host can open the database in Data › SQLite, and what to say when it cannot. */
export interface ViewerDatabaseAction {
  canOpen: boolean;
  hint?: string;
}

/**
 * What the host around a viewer offers for the open file. A button for an action the host does not
 * offer is not drawn, so the same views serve a phone's files and an app's private storage.
 */
export interface ViewerActions {
  openOnComputer: boolean;
  chooseApp: boolean;
  download: boolean;
  database: ViewerDatabaseAction;
}

export type ViewerFileAction = "openOnComputer" | "chooseApp" | "download";

/** The one action a view fills with the accent: the first the host offers, in this order. */
export function primaryFileAction(actions: ViewerActions): ViewerFileAction | null {
  if (actions.openOnComputer) return "openOnComputer";
  if (actions.chooseApp) return "chooseApp";
  if (actions.download) return "download";
  return null;
}
