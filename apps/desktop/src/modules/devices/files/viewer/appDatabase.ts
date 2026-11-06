export interface AppDatabase {
  packageName: string;
  fileName: string;
}

const APP_DATABASE = /^\/data\/(?:data|user\/\d+)\/([^/]+)\/databases\/([^/]+)$/;

/** The app and file name when a path is an app's own database, the folder Data › SQLite lists. */
export function appDatabaseFromPath(path: string): AppDatabase | null {
  const match = APP_DATABASE.exec(path);
  if (!match?.[1] || !match[2]) return null;
  return { packageName: match[1], fileName: match[2] };
}
