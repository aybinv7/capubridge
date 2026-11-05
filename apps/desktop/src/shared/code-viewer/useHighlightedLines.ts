import { onScopeDispose, shallowRef, triggerRef, watch, type Ref } from "vue";
import type { GrammarState } from "shiki/core";
import { highlighterFor, tokenizeChunk } from "./highlighter";
import type { CodeToken } from "./textSegments";
import type { CodeLanguage, TextLanguage } from "./codeLanguage";

const LINE_BUDGET = 20_000;
const CHAR_BUDGET = 1_000_000;
const FIRST_CHUNK = 200;
const CHUNK = 1_000;

function isCodeLanguage(language: TextLanguage): language is CodeLanguage {
  return language !== "plain" && language !== "log";
}

function budgetedLineCount(lines: readonly string[]): number {
  let chars = 0;
  const limit = Math.min(lines.length, LINE_BUDGET);
  for (let index = 0; index < limit; index += 1) {
    chars += (lines[index]?.length ?? 0) + 1;
    if (chars > CHAR_BUDGET) return index + 1;
  }
  return limit;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Syntax colours for the first part of a file, filled in block by block between frames so a
 * 2 MB file never blocks the window. Lines past the budget (20,000 lines or about 1 MB) stay
 * plain; `tokens[i]` is undefined until line `i` is coloured.
 */
export function useHighlightedLines(lines: Ref<readonly string[]>, language: Ref<TextLanguage>) {
  const tokens = shallowRef<CodeToken[][]>([]);
  const coloured = shallowRef(0);
  const total = shallowRef(0);
  let run = 0;

  async function highlight(all: readonly string[], lang: TextLanguage, id: number) {
    if (!isCodeLanguage(lang)) return;
    const limit = budgetedLineCount(all);
    total.value = limit;
    try {
      const highlighter = await highlighterFor(lang);
      let state: GrammarState | undefined;
      let start = 0;
      while (start < limit && id === run) {
        const end = Math.min(limit, start + (start === 0 ? FIRST_CHUNK : CHUNK));
        const chunk = tokenizeChunk(highlighter, lang, all.slice(start, end).join("\n"), state);
        state = chunk.state;
        tokens.value.push(...chunk.lines);
        triggerRef(tokens);
        coloured.value = end;
        start = end;
        await nextFrame();
      }
    } catch (error) {
      if (id === run) console.warn(`Syntax colours unavailable for ${lang}`, error);
    }
  }

  watch(
    [lines, language],
    ([all, lang]) => {
      run += 1;
      tokens.value = [];
      coloured.value = 0;
      total.value = 0;
      void highlight(all, lang, run);
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    run += 1;
  });

  return { tokens, coloured, total };
}
