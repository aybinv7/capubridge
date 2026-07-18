import type { CDPClient } from "../client.js";

export interface HighlightConfig {
  showInfo?: boolean;
  showStyles?: boolean;
  showRulers?: boolean;
  showAccessibilityInfo?: boolean;
  showExtensionLines?: boolean;
  contentColor?: RGBA;
  paddingColor?: RGBA;
  borderColor?: RGBA;
  marginColor?: RGBA;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a?: number;
}

const DEFAULT_HIGHLIGHT: HighlightConfig = {
  showInfo: true,
  showStyles: true,
  contentColor: { r: 111, g: 168, b: 220, a: 0.66 },
  paddingColor: { r: 147, g: 196, b: 125, a: 0.55 },
  borderColor: { r: 255, g: 229, b: 153, a: 0.66 },
  marginColor: { r: 246, g: 178, b: 107, a: 0.66 },
};

export class OverlayDomain {
  constructor(private client: CDPClient) {}

  async enable(): Promise<void> {
    await this.client.send("Overlay.enable");
  }

  async disable(): Promise<void> {
    await this.client.send("Overlay.disable");
  }

  async setInspectMode(
    mode: "searchForNode" | "searchForUAShadowDOM" | "captureAreaScreenshot" | "none",
    highlightConfig?: HighlightConfig,
  ): Promise<void> {
    await this.client.send("Overlay.setInspectMode", {
      mode,
      highlightConfig: highlightConfig ?? DEFAULT_HIGHLIGHT,
    });
  }

  async highlightNode(nodeId: number, highlightConfig?: HighlightConfig): Promise<void> {
    await this.client.send("Overlay.highlightNode", {
      nodeId,
      highlightConfig: highlightConfig ?? DEFAULT_HIGHLIGHT,
    });
  }

  async hideHighlight(): Promise<void> {
    await this.client.send("Overlay.hideHighlight");
  }

  onInspectNodeRequested(handler: (params: { backendNodeId: number }) => void): () => void {
    return this.client.on("Overlay.inspectNodeRequested", handler as (p: unknown) => void);
  }

  onNodeHighlightRequested(handler: (params: { nodeId: number }) => void): () => void {
    return this.client.on("Overlay.nodeHighlightRequested", handler as (p: unknown) => void);
  }
}
