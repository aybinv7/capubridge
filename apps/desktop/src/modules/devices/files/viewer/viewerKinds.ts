/** What the viewer shows a file as, once its bytes are known. */
export type ViewerKind = "image" | "video" | "audio" | "json" | "text" | "sqlite" | "binary";

/** A guess from the name alone; `unknown` files are sniffed from their first bytes. */
export type NameKind = ViewerKind | "unknown";

export type CodeLanguage =
  | "json"
  | "javascript"
  | "typescript"
  | "tsx"
  | "jsx"
  | "xml"
  | "html"
  | "css"
  | "sql"
  | "yaml"
  | "ini"
  | "properties"
  | "kotlin"
  | "java"
  | "groovy"
  | "shellscript"
  | "vue"
  | "rust"
  | "markdown"
  | "toml";

/** How a text file is coloured: a grammar, hand-made log levels, or not at all. */
export type TextLanguage = CodeLanguage | "log" | "plain";

const KIND_BY_EXTENSION: Record<string, NameKind> = {};

function register(kind: NameKind, extensions: readonly string[]) {
  for (const extension of extensions) KIND_BY_EXTENSION[extension] = kind;
}

register("image", ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "avif"]);
register("video", ["mp4", "webm", "ogv", "mov", "m4v", "3gp", "mkv"]);
register("audio", ["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac"]);
register("json", ["json", "har", "map", "webmanifest"]);
register("sqlite", ["db", "sqlite", "sqlite3", "db3"]);
register("binary", [
  "apk",
  "aab",
  "dex",
  "odex",
  "vdex",
  "oat",
  "arsc",
  "so",
  "jar",
  "class",
  "zip",
  "gz",
  "tgz",
  "tar",
  "bz2",
  "xz",
  "7z",
  "rar",
  "pdf",
  "heic",
  "heif",
  "bin",
]);

const LANGUAGE_BY_EXTENSION: Record<string, TextLanguage> = {
  json: "json",
  har: "json",
  map: "json",
  webmanifest: "json",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  xml: "xml",
  plist: "xml",
  xsd: "xml",
  html: "html",
  htm: "html",
  css: "css",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  ini: "ini",
  conf: "ini",
  cfg: "ini",
  properties: "properties",
  kt: "kotlin",
  kts: "kotlin",
  java: "java",
  gradle: "groovy",
  sh: "shellscript",
  bash: "shellscript",
  vue: "vue",
  rs: "rust",
  md: "markdown",
  toml: "toml",
  log: "log",
  txt: "plain",
  csv: "plain",
  tsv: "plain",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  m4v: "video/mp4",
  "3gp": "video/3gpp",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
};

/** The lower-case extension of a file name, or "" when it has none (dot files included). */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

/** What a file most likely is, judged by its extension alone. */
export function kindFromName(name: string): NameKind {
  const extension = extensionOf(name);
  const known = KIND_BY_EXTENSION[extension];
  if (known) return known;
  return extension in LANGUAGE_BY_EXTENSION ? "text" : "unknown";
}

/** How text in this file is coloured; files without a known extension stay plain. */
export function languageFromName(name: string): TextLanguage {
  return LANGUAGE_BY_EXTENSION[extensionOf(name)] ?? "plain";
}

/** The MIME type the Blob is labelled with, so SVG and media decode reliably. */
export function mimeFromName(name: string): string {
  return MIME_BY_EXTENSION[extensionOf(name)] ?? "";
}

const KIND_WORDS: Record<ViewerKind, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  json: "JSON",
  text: "Text",
  sqlite: "SQLite database",
  binary: "Binary file",
};

const LANGUAGE_WORDS: Partial<Record<TextLanguage, string>> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  xml: "XML",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  yaml: "YAML",
  ini: "Config",
  properties: "Properties",
  kotlin: "Kotlin",
  java: "Java",
  groovy: "Gradle",
  shellscript: "Shell script",
  vue: "Vue",
  rust: "Rust",
  markdown: "Markdown",
  toml: "TOML",
  log: "Log",
};

/** The word the header shows for what the file is. */
export function kindWord(kind: ViewerKind, language: TextLanguage = "plain"): string {
  if (kind === "text") return LANGUAGE_WORDS[language] ?? KIND_WORDS.text;
  return KIND_WORDS[kind];
}
