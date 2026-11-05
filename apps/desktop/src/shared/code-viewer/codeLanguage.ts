/** A language with a syntax grammar the code viewer can colour. */
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

/** How a text is coloured: a grammar, hand-made log levels, or not at all. */
export type TextLanguage = CodeLanguage | "log" | "plain";
