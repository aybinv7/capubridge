import type { CDPClient } from "../client.js";

export interface DOMNode {
  nodeId: number;
  backendNodeId: number;
  nodeType: number;
  nodeName: string;
  localName: string;
  nodeValue: string;
  childNodeCount?: number;
  children?: DOMNode[];
  attributes?: string[]; // flat pairs: [name, value, name, value, ...]
  documentURL?: string;
  frameId?: string;
  shadowRoots?: DOMNode[];
  contentDocument?: DOMNode;
}

export interface BoxModel {
  content: number[]; // quad: [x1,y1, x2,y2, x3,y3, x4,y4]
  padding: number[];
  border: number[];
  margin: number[];
  width: number;
  height: number;
}

export interface NodeForLocation {
  nodeId: number;
  backendNodeId: number;
  frameId?: string;
}

export class DOMDomain {
  constructor(private client: CDPClient) {}

  async enable(): Promise<void> {
    await this.client.send("DOM.enable");
  }

  async disable(): Promise<void> {
    await this.client.send("DOM.disable");
  }

  async getDocument(depth = 2): Promise<DOMNode> {
    const result = await this.client.send<{ root: DOMNode }>("DOM.getDocument", {
      depth,
      pierce: true,
    });
    return result.root;
  }

  async requestChildNodes(nodeId: number, depth = 1): Promise<void> {
    await this.client.send("DOM.requestChildNodes", { nodeId, depth });
  }

  async getOuterHTML(nodeId: number): Promise<string> {
    const result = await this.client.send<{ outerHTML: string }>("DOM.getOuterHTML", { nodeId });
    return result.outerHTML;
  }

  async getBoxModel(nodeId: number): Promise<BoxModel> {
    const result = await this.client.send<{ model: BoxModel }>("DOM.getBoxModel", { nodeId });
    return result.model;
  }

  async querySelector(nodeId: number, selector: string): Promise<number> {
    const result = await this.client.send<{ nodeId: number }>("DOM.querySelector", {
      nodeId,
      selector,
    });
    return result.nodeId;
  }

  async getAttributes(nodeId: number): Promise<string[]> {
    const result = await this.client.send<{ attributes: string[] }>("DOM.getAttributes", {
      nodeId,
    });
    return result.attributes;
  }

  async getNodeForLocation(
    x: number,
    y: number,
    includeUserAgentShadowDOM = true,
    ignorePointerEventsNone = false,
  ): Promise<NodeForLocation | null> {
    const result = await this.client.send<NodeForLocation>("DOM.getNodeForLocation", {
      x,
      y,
      includeUserAgentShadowDOM,
      ignorePointerEventsNone,
    });
    return result.nodeId ? result : null;
  }

  async setAttributeValue(nodeId: number, name: string, value: string): Promise<void> {
    await this.client.send("DOM.setAttributeValue", { nodeId, name, value });
  }

  async pushNodesByBackendIdsToFrontend(backendNodeIds: number[]): Promise<number[]> {
    const result = await this.client.send<{ nodeIds: number[] }>(
      "DOM.pushNodesByBackendIdsToFrontend",
      { backendNodeIds },
    );
    return result.nodeIds;
  }

  onSetChildNodes(handler: (params: { parentId: number; nodes: DOMNode[] }) => void): () => void {
    return this.client.on("DOM.setChildNodes", handler as (p: unknown) => void);
  }

  onChildNodeInserted(
    handler: (params: { parentNodeId: number; previousNodeId: number; node: DOMNode }) => void,
  ): () => void {
    return this.client.on("DOM.childNodeInserted", handler as (p: unknown) => void);
  }

  onChildNodeRemoved(
    handler: (params: { parentNodeId: number; nodeId: number }) => void,
  ): () => void {
    return this.client.on("DOM.childNodeRemoved", handler as (p: unknown) => void);
  }

  onAttributeModified(
    handler: (params: { nodeId: number; name: string; value: string }) => void,
  ): () => void {
    return this.client.on("DOM.attributeModified", handler as (p: unknown) => void);
  }
}
