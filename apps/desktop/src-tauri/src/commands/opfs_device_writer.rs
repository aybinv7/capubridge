//! Writing OPFS files on the page, for changes Capubridge makes to an app's own SQLite database.
//!
//! Every write runs in a page the app was paused in (see `AppPause` in the protocol package):
//! the app's code never ran there, so no SQLite VFS holds the file. The installer refuses any
//! other page, so nothing here can write under a live database. A file is rewritten through
//! `createWritable`, which the browser swaps in only once the stream closes (all or nothing);
//! where a WebView lacks it, through a `FileSystemSyncAccessHandle` in a worker started from a
//! blob. Both wait out the lock the app's worker held until the page it ran in is torn down.

use base64::Engine;
use serde::Deserialize;

use crate::commands::opfs_pull::{escape_js_string, CdpSession};

/// What a SQLite database leaves beside it in OPFS, by what SQLite names it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum CompanionRole {
    Journal,
    Wal,
    Shm,
}

/// A rollback journal, write-ahead log or shared-memory file of one database.
#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Companion {
    pub path: String,
    pub role: CompanionRole,
    /// Holds changes the database file does not have yet: a journal with a live header, or a
    /// write-ahead log with frames in it.
    pub hot: bool,
}

#[derive(Deserialize)]
struct CompanionsReply {
    companions: Vec<Companion>,
}

/// Writes one OPFS file from its start or from an offset, then sets its length.
pub(crate) trait OpfsSink {
    /// Takes the file for writing; fails when the page is not one the app is paused in.
    async fn begin(&mut self, path: &str) -> Result<(), String>;
    async fn write(&mut self, at: u64, bytes: &[u8]) -> Result<(), String>;
    /// Cuts the file to `size` bytes and commits what was written.
    async fn finish(&mut self, size: u64) -> Result<(), String>;
    /// Drops what was written since `begin` where the browser allows it, and lets the file go.
    async fn abort(&mut self);
}

/// Finds and removes the files SQLite keeps beside a database.
pub(crate) trait OpfsSqliteFiles {
    async fn companions(&mut self, path: &str, sah_pool: bool) -> Result<Vec<Companion>, String>;
    /// Removes plain OPFS files; one already gone counts as removed.
    async fn remove_files(&mut self, paths: &[String]) -> Result<(), String>;
}

const WORKER_SOURCE: &str = r#"
let sah = null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const busy = (e) => !!e && (e.name === 'NoModificationAllowedError' || e.name === 'InvalidModificationError');
async function open(path, waitMs) {
  const parts = String(path).split('/').filter(Boolean);
  const name = parts.pop();
  let dir = await navigator.storage.getDirectory();
  for (const part of parts) dir = await dir.getDirectoryHandle(part);
  const handle = await dir.getFileHandle(name);
  const deadline = Date.now() + waitMs;
  for (;;) {
    try { return await handle.createSyncAccessHandle(); }
    catch (e) { if (busy(e) && Date.now() < deadline) { await sleep(200); continue; } throw e; }
  }
}
onmessage = async (event) => {
  const message = event.data;
  try {
    if (message.op === 'begin') sah = await open(message.path, message.waitMs);
    else if (message.op === 'write') {
      let done = 0;
      while (done < message.bytes.byteLength) done += sah.write(message.bytes.subarray(done), { at: message.at + done });
    } else if (message.op === 'finish') { sah.truncate(message.size); sah.flush(); sah.close(); sah = null; }
    else if (message.op === 'abort') { if (sah) { sah.close(); sah = null; } }
    postMessage({ id: message.id, ok: true });
  } catch (e) {
    postMessage({ id: message.id, ok: false, error: e && e.message ? e.message : String(e), busy: busy(e) });
  }
};
"#;

/// Installs `window.__capubridgeWriter` in the paused page; refuses a page the app runs in.
fn install_script() -> String {
    let worker = serde_json::to_string(WORKER_SOURCE).unwrap_or_else(|_| "''".to_string());
    format!(
        r#"(() => {{
  try {{
    if (!window.__capubridgePaused) return JSON.stringify({{ __opfsError: 'The app is not paused, so its files are not written.' }});
    if (window.__capubridgeWriter) return JSON.stringify({{ ok: true }});
    const WORKER = {worker};
    const WAIT_MS = 8000;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const busy = (e) => !!e && (e.name === 'NoModificationAllowedError' || e.name === 'InvalidModificationError');
    const fail = (e) => JSON.stringify({{ __opfsError: e && e.message ? e.message : String(e), busy: busy(e) }});
    const ok = () => JSON.stringify({{ ok: true }});
    const decode = (b64) => {{
      const text = atob(b64);
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
      return bytes;
    }};
    async function fileHandle(path) {{
      const parts = String(path).split('/').filter(Boolean);
      const name = parts.pop();
      if (!name) throw new Error('Empty path');
      let dir = await navigator.storage.getDirectory();
      for (const part of parts) dir = await dir.getDirectoryHandle(part);
      return dir.getFileHandle(name);
    }}
    async function viaWritable(handle) {{
      const deadline = Date.now() + WAIT_MS;
      let stream;
      for (;;) {{
        try {{ stream = await handle.createWritable({{ keepExistingData: true }}); break; }}
        catch (e) {{ if (busy(e) && Date.now() < deadline) {{ await sleep(200); continue; }} throw e; }}
      }}
      return {{
        write: (at, bytes) => stream.write({{ type: 'write', position: at, data: bytes }}),
        finish: async (size) => {{ await stream.truncate(size); await stream.close(); }},
        abort: () => stream.abort(),
      }};
    }}
    async function viaWorker(path) {{
      const Native = window.__capubridgeWorker || window.Worker;
      const url = URL.createObjectURL(new Blob([WORKER], {{ type: 'text/javascript' }}));
      const worker = new Native(url);
      const waiting = new Map();
      let next = 0;
      worker.onmessage = (event) => {{
        const settle = waiting.get(event.data.id);
        if (settle) {{ waiting.delete(event.data.id); settle(event.data); }}
      }};
      worker.onerror = (event) => {{
        for (const settle of waiting.values()) settle({{ ok: false, error: event.message || 'The writer stopped' }});
        waiting.clear();
      }};
      const call = (message, transfer) => new Promise((resolve, reject) => {{
        const id = ++next;
        waiting.set(id, (reply) => {{
          if (reply.ok) return resolve();
          const error = new Error(reply.error);
          if (reply.busy) error.name = 'NoModificationAllowedError';
          reject(error);
        }});
        worker.postMessage(Object.assign({{ id }}, message), transfer || []);
      }});
      const stop = () => {{ worker.terminate(); URL.revokeObjectURL(url); }};
      try {{ await call({{ op: 'begin', path, waitMs: WAIT_MS }}); }}
      catch (e) {{ stop(); throw e; }}
      return {{
        write: (at, bytes) => call({{ op: 'write', at, bytes }}, [bytes.buffer]),
        finish: async (size) => {{ try {{ await call({{ op: 'finish', size }}); }} finally {{ stop(); }} }},
        abort: async () => {{ try {{ await call({{ op: 'abort' }}); }} finally {{ stop(); }} }},
      }};
    }}
    let current = null;
    window.__capubridgeWriter = {{
      async begin(path) {{
        try {{
          if (current) {{ const old = current; current = null; try {{ await old.abort(); }} catch {{}} }}
          const handle = await fileHandle(path);
          if (typeof handle.createWritable === 'function') {{
            try {{ current = await viaWritable(handle); return ok(); }}
            catch (e) {{ if (busy(e)) throw e; }}
          }}
          current = await viaWorker(path);
          return ok();
        }} catch (e) {{ return fail(e); }}
      }},
      async write(at, b64) {{
        try {{
          if (!current) throw new Error('No file is being written');
          await current.write(at, decode(b64));
          return ok();
        }} catch (e) {{ return fail(e); }}
      }},
      async finish(size) {{
        try {{
          if (!current) throw new Error('No file is being written');
          const writer = current;
          current = null;
          await writer.finish(size);
          return ok();
        }} catch (e) {{ return fail(e); }}
      }},
      async abort() {{
        const writer = current;
        current = null;
        try {{ if (writer) await writer.abort(); }} catch {{}}
        return ok();
      }},
    }};
    return ok();
  }} catch (e) {{
    return JSON.stringify({{ __opfsError: e && e.message ? e.message : String(e) }});
  }}
}})()"#
    )
}

fn companions_script(path: &str, sah_pool: bool) -> String {
    let path = escape_js_string(path);
    format!(
        r#"(async () => {{
  try {{
    const SAH = {sah_pool};
    const HEADER = 4096;
    const JOURNAL = [0xd9, 0xd5, 0x05, 0xf9, 0x20, 0xa1, 0x63, 0xd7];
    const parts = '{path}'.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) throw new Error('Empty path');
    let dir = await navigator.storage.getDirectory();
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
    const folder = parts.join('/');
    const join = (entry) => folder ? folder + '/' + entry : entry;
    const head = async (file, at, length) => new Uint8Array(await file.slice(at, at + length).arrayBuffer());
    const out = [];
    async function describe(path, role, file, at) {{
      const size = Math.max(0, file.size - at);
      let hot = false;
      if (role === 'journal' && size >= 8) {{
        const bytes = await head(file, at, 8);
        hot = JOURNAL.every((value, index) => bytes[index] === value);
      }} else if (role === 'wal') hot = size > 0;
      out.push({{ path, role, size, hot }});
    }}
    if (!SAH) {{
      for (const role of ['journal', 'wal', 'shm']) {{
        try {{
          const file = await (await dir.getFileHandle(name + '-' + role)).getFile();
          await describe(join(name + '-' + role), role, file, 0);
        }} catch (e) {{
          if (!e || e.name !== 'NotFoundError') throw e;
        }}
      }}
    }} else {{
      const owner = async (file) => {{
        const bytes = await head(file, 0, 512);
        let end = 0;
        while (end < bytes.length && bytes[end] !== 0) end++;
        if (end === 0) return '';
        try {{ return new TextDecoder('utf-8', {{ fatal: true }}).decode(bytes.subarray(0, end)); }}
        catch {{ return ''; }}
      }};
      const own = await owner(await (await dir.getFileHandle(name)).getFile());
      if (!own) throw new Error('The pool slot holds no database any more');
      const roles = {{ [own + '-journal']: 'journal', [own + '-wal']: 'wal', [own + '-shm']: 'shm' }};
      for await (const [entry, handle] of dir.entries()) {{
        if (handle.kind !== 'file' || entry === name) continue;
        const file = await handle.getFile();
        if (file.size < HEADER) continue;
        const role = roles[await owner(file)];
        if (role) await describe(join(entry), role, file, HEADER);
      }}
    }}
    return JSON.stringify({{ companions: out }});
  }} catch (e) {{
    return JSON.stringify({{ __opfsError: e && e.message ? e.message : String(e) }});
  }}
}})()"#
    )
}

fn remove_files_script(paths: &[String]) -> String {
    let paths = serde_json::to_string(paths).unwrap_or_else(|_| "[]".to_string());
    format!(
        r#"(async () => {{
  try {{
    if (!window.__capubridgePaused) return JSON.stringify({{ __opfsError: 'The app is not paused, so its files are not deleted.' }});
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const busy = (e) => !!e && (e.name === 'NoModificationAllowedError' || e.name === 'InvalidModificationError');
    for (const path of {paths}) {{
      const parts = String(path).split('/').filter(Boolean);
      const name = parts.pop();
      if (!name) throw new Error('Empty path');
      let dir;
      try {{
        dir = await navigator.storage.getDirectory();
        for (const part of parts) dir = await dir.getDirectoryHandle(part);
      }} catch (e) {{
        if (e && e.name === 'NotFoundError') continue;
        throw e;
      }}
      const deadline = Date.now() + 8000;
      for (;;) {{
        try {{ await dir.removeEntry(name); break; }}
        catch (e) {{
          if (e && e.name === 'NotFoundError') break;
          if (busy(e) && Date.now() < deadline) {{ await sleep(200); continue; }}
          throw e;
        }}
      }}
    }}
    return JSON.stringify({{ ok: true }});
  }} catch (e) {{
    return JSON.stringify({{ __opfsError: e && e.message ? e.message : String(e) }});
  }}
}})()"#
    )
}

impl CdpSession {
    async fn writer_call(&mut self, call: &str) -> Result<(), String> {
        self.evaluate_string(&install_script()).await?;
        self.evaluate_string(&format!("window.__capubridgeWriter.{call}"))
            .await
            .map(|_| ())
    }
}

impl OpfsSink for CdpSession {
    async fn begin(&mut self, path: &str) -> Result<(), String> {
        let path = escape_js_string(path);
        self.writer_call(&format!("begin('{path}')")).await
    }

    async fn write(&mut self, at: u64, bytes: &[u8]) -> Result<(), String> {
        let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
        self.writer_call(&format!("write({at}, '{encoded}')")).await
    }

    async fn finish(&mut self, size: u64) -> Result<(), String> {
        self.writer_call(&format!("finish({size})")).await
    }

    async fn abort(&mut self) {
        let _ = self.writer_call("abort()").await;
    }
}

impl OpfsSqliteFiles for CdpSession {
    async fn companions(&mut self, path: &str, sah_pool: bool) -> Result<Vec<Companion>, String> {
        let raw = self
            .evaluate_string(&companions_script(path, sah_pool))
            .await?;
        let reply: CompanionsReply = serde_json::from_str(&raw)
            .map_err(|error| format!("Malformed answer about the database's journals: {error}"))?;
        Ok(reply.companions)
    }

    async fn remove_files(&mut self, paths: &[String]) -> Result<(), String> {
        if paths.is_empty() {
            return Ok(());
        }
        self.evaluate_string(&remove_files_script(paths))
            .await
            .map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scripts_take_paths_as_literals() {
        let script = companions_script("a/it's.db", true);
        assert!(script.contains(r"'a/it\'s.db'"));
        let removal = remove_files_script(&["x/\"y\".db".to_string()]);
        assert!(removal.contains(r#"["x/\"y\".db"]"#));
    }

    #[test]
    fn the_writer_refuses_a_page_the_app_runs_in() {
        assert!(install_script().contains("if (!window.__capubridgePaused)"));
        assert!(remove_files_script(&["a".to_string()]).contains("if (!window.__capubridgePaused)"));
    }

    #[test]
    fn companions_parse_by_role() {
        let reply: CompanionsReply = serde_json::from_str(
            r#"{"companions":[{"path":"db-journal","role":"journal","size":512,"hot":true}]}"#,
        )
        .expect("parses");
        assert_eq!(reply.companions[0].role, CompanionRole::Journal);
        assert!(reply.companions[0].hot);
    }
}
