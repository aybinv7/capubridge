import type { CDPClient } from "../client.js";

export interface CSSProperty {
  name: string;
  value: string;
  important?: boolean;
  disabled?: boolean;
  range?: SourceRange;
}

export interface CSSRule {
  selectorList: { selectors: { text: string }[]; text: string };
  style: CSSStyle;
  origin: "regular" | "user-agent" | "inspector" | "injected";
  styleSheetId?: string;
}

export interface CSSStyle {
  cssProperties: CSSProperty[];
  shorthandEntries: { name: string; value: string }[];
}

export interface SourceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface ComputedStyle {
  name: string;
  value: string;
}

export interface MatchedStyles {
  inlineStyle?: CSSStyle;
  matchedCSSRules: {
    rule: CSSRule;
    matchingSelectors: number[];
  }[];
  inherited: {
    inlineStyle?: CSSStyle;
    matchedCSSRules: { rule: CSSRule; matchingSelectors: number[] }[];
  }[];
}

export class CSSDomain {
  constructor(private client: CDPClient) {}

  async enable(): Promise<void> {
    await this.client.send("CSS.enable");
  }

  async disable(): Promise<void> {
    await this.client.send("CSS.disable");
  }

  async getMatchedStylesForNode(nodeId: number): Promise<MatchedStyles> {
    return this.client.send<MatchedStyles>("CSS.getMatchedStylesForNode", { nodeId });
  }

  async getComputedStyleForNode(nodeId: number): Promise<ComputedStyle[]> {
    const result = await this.client.send<{ computedStyle: ComputedStyle[] }>(
      "CSS.getComputedStyleForNode",
      { nodeId },
    );
    return result.computedStyle;
  }

  async getInlineStylesForNode(
    nodeId: number,
  ): Promise<{ inlineStyle?: CSSStyle; attributesStyle?: CSSStyle }> {
    return this.client.send("CSS.getInlineStylesForNode", { nodeId });
  }
}
