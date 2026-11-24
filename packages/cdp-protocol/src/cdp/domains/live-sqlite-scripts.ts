/** The object group every handle Capubridge takes in a worker is kept in, released after. */
export const LIVE_SQLITE_GROUP = "capubridge-live-sqlite";

const NAME = `const norm = (n) => String(n || '').replace(/^file:/, '').replace(/[?#].*$/, '').replace(/^\\/+/, '');
  const open = (db) => {
    try { return !!db && (typeof db.isOpen === 'function' ? db.isOpen() : !!db.pointer); }
    catch { return false; }
  };
  const name = (db) => norm(db.filename || (typeof db.dbFilename === 'function' ? db.dbFilename() : ''));`;

/**
 * Called on the array of every function in a worker: the prototypes of sqlite-wasm's `oo1.DB`
 * there, one per copy of the library. Its subclasses (`OpfsDb`, `OpfsSAHPoolDb`) share it, so
 * the instances of any of them are found through it.
 */
export const FIND_DB_PROTOTYPES = `function () {
  const isDb = (f) => {
    try {
      const p = f.prototype;
      return !!p && typeof p.exec === 'function' && typeof p.selectValue === 'function'
        && typeof p.changes === 'function' && typeof p.checkRc === 'function';
    } catch { return false; }
  };
  const found = this.filter(isDb);
  return found
    .filter((f) => !found.some((g) => g !== f && f.prototype instanceof g))
    .map((f) => f.prototype);
}`;

/** Called on the array of a prototype's instances: the filenames of the open connections. */
export const LIST_OPEN = `function () {
  ${NAME}
  return this.filter(open).map(name);
}`;

/**
 * Called on the array of a prototype's instances with `{ filename, change }`: applies the change
 * through the one open connection to `filename`. It runs as a fresh task of the worker
 * (`setTimeout`), never in the middle of a SQLite call the app is making, and in one
 * `BEGIN IMMEDIATE` transaction, which SQLite refuses while the app holds a transaction open
 * (`busy`). Foreign keys are not enforced for it, then set back as they were; the rows left
 * pointing at removed rows are counted. Any error rolls the whole change back (`failed`).
 */
export const RUN_CHANGE = `function (spec) {
  ${NAME}
  const dbs = this;
  const message = (error) => String((error && error.message) || error);
  const violations = (db) => {
    try {
      const out = new Map();
      for (const [table, parent, rows] of db.selectArrays('SELECT "table", parent, count(*) FROM pragma_foreign_key_check GROUP BY 1, 2')) {
        out.set(table + '\\u0000' + parent, { table, parent, rows: Number(rows) });
      }
      return out;
    } catch { return null; }
  };
  const dangling = (before, after) => {
    if (!before || !after) return [];
    const out = [];
    for (const [key, entry] of after) {
      const rows = entry.rows - (before.get(key) ? before.get(key).rows : 0);
      if (rows > 0) out.push({ table: entry.table, parent: entry.parent, rows });
    }
    return out;
  };
  const quote = (id) => '"' + String(id).replace(/"/g, '""') + '"';
  const apply = (db, change) => {
    if (change.kind === 'sql') {
      db.exec(change.sql);
    } else if (change.kind === 'every-table') {
      const tables = db.selectValues("SELECT name FROM pragma_table_list WHERE schema = 'main' AND type IN ('table', 'virtual') AND name NOT LIKE 'sqlite\\\\_%' ESCAPE '\\\\' ORDER BY name");
      for (const table of tables) db.exec('DELETE FROM ' + quote(table));
    } else {
      const total = change.statements.length;
      change.statements.forEach((sql, index) => {
        db.exec(sql);
        const rows = db.changes();
        if (rows !== 1) {
          throw new Error('Change ' + (index + 1) + ' of ' + total + ' would touch ' + rows + ' rows instead of one, so nothing was saved');
        }
      });
    }
  };
  const run = () => {
    const matches = dbs.filter((db) => open(db) && name(db) === spec.filename);
    if (matches.length === 0) return { status: 'unavailable', reason: 'The app closed it.' };
    if (matches.length > 1) return { status: 'unavailable', reason: 'The app has it open more than once.' };
    const db = matches[0];
    const keys = Number(db.selectValue('PRAGMA foreign_keys')) ? 1 : 0;
    try {
      db.exec('PRAGMA foreign_keys = OFF');
      try { db.exec('BEGIN IMMEDIATE'); }
      catch (error) { return { status: 'busy', reason: message(error) }; }
      try {
        const counted = spec.change.kind !== 'every-table';
        const before = counted ? violations(db) : null;
        apply(db, spec.change);
        const after = counted ? violations(db) : null;
        db.exec('COMMIT');
        return { status: 'done', dangling: dangling(before, after) };
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        return { status: 'failed', message: message(error) };
      }
    } finally {
      try { db.exec('PRAGMA foreign_keys = ' + keys); } catch {}
    }
  };
  return new Promise((resolve) => setTimeout(() => {
    try { resolve(run()); }
    catch (error) { resolve({ status: 'failed', message: message(error) }); }
  }, 0));
}`;
