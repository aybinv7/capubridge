import type { GrammarState, HighlighterCore, LanguageRegistration, ThemedToken } from "shiki/core";
import type { CodeToken } from "./textSegments";
import type { CodeLanguage } from "./viewerKinds";

type GrammarModule = { default: LanguageRegistration[] };

const GRAMMARS: Record<CodeLanguage, () => Promise<GrammarModule>> = {
  json: () => import("shiki/langs/json.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  ini: () => import("shiki/langs/ini.mjs"),
  properties: () => import("shiki/langs/properties.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  groovy: () => import("shiki/langs/groovy.mjs"),
  shellscript: () => import("shiki/langs/shellscript.mjs"),
  vue: () => import("shiki/langs/vue.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
};

/** Token colours resolve to `--code-token-*` variables that the text view maps to Bench tokens. */
const THEME = "bench-code";
const MAX_LINE_LENGTH = 2000;

let core: Promise<HighlighterCore> | null = null;
const loading = new Map<CodeLanguage, Promise<void>>();

async function createCore(): Promise<HighlighterCore> {
  const [{ createHighlighterCore, createCssVariablesTheme }, { createJavaScriptRegexEngine }] =
    await Promise.all([import("shiki/core"), import("shiki/engine/javascript")]);
  return createHighlighterCore({
    themes: [createCssVariablesTheme({ name: THEME, variablePrefix: "--code-", fontStyle: true })],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
}

/**
 * The shared highlighter with `language` loaded. Shiki, its regex engine and each grammar are
 * fetched on first use only, so the viewer costs nothing until a code file is opened.
 */
export async function highlighterFor(language: CodeLanguage): Promise<HighlighterCore> {
  core ??= createCore().catch((error: unknown) => {
    core = null;
    throw error;
  });
  const highlighter = await core;
  let pending = loading.get(language);
  if (!pending) {
    pending = GRAMMARS[language]()
      .then((grammar) => highlighter.loadLanguage(...grammar.default))
      .catch((error: unknown) => {
        loading.delete(language);
        throw error;
      });
    loading.set(language, pending);
  }
  await pending;
  return highlighter;
}

function toTokens(line: readonly ThemedToken[]): CodeToken[] {
  return line.map((token) => ({
    text: token.content,
    color: token.color,
    italic: token.fontStyle !== undefined && (token.fontStyle & 1) === 1 ? true : undefined,
  }));
}

export interface TokenChunk {
  lines: CodeToken[][];
  state: GrammarState | undefined;
}

/** Tokenizes one block of lines, continuing from the grammar state the previous block ended in. */
export function tokenizeChunk(
  highlighter: HighlighterCore,
  language: CodeLanguage,
  code: string,
  state: GrammarState | undefined,
): TokenChunk {
  const result = highlighter.codeToTokens(code, {
    lang: language,
    theme: THEME,
    grammarState: state,
    tokenizeMaxLineLength: MAX_LINE_LENGTH,
  });
  return { lines: result.tokens.map(toTokens), state: result.grammarState };
}
