import { ref } from "vue";
import { CSSDomain, DOMDomain } from "utils";
import type { SourceRange, CSSStyle } from "utils";
import { useCDP } from "@/composables/useCDP";
import { useInspectStore } from "@/stores/inspect.store";

export interface InspectorStyleSheetCache {
  styleSheetId: string;
  frameId: string;
  ruleRanges: Map<string, SourceRange>;
  nextLine: number;
}

export function useElementMutations() {
  const { activeClient } = useCDP();
  const store = useInspectStore();
  const isMutating = ref(false);
  const lastError = ref<string | null>(null);

  function domains() {
    const client = activeClient.value;
    if (!client) return null;
    return {
      css: new CSSDomain(client),
      dom: new DOMDomain(client),
      client,
    };
  }

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    isMutating.value = true;
    lastError.value = null;
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[mutations] ${label} failed:`, msg);
      lastError.value = `${label}: ${msg}`;
      return null;
    } finally {
      isMutating.value = false;
    }
  }

  async function setAttribute(nodeId: number, name: string, value: string) {
    const d = domains();
    if (!d) return false;
    const r = await run("setAttribute", () => d.dom.setAttributeValue(nodeId, name, value));
    return r !== null;
  }

  async function setAttributesAsText(nodeId: number, text: string, replaceName?: string) {
    const d = domains();
    if (!d) return false;
    const r = await run("setAttributesAsText", () =>
      d.dom.setAttributesAsText(nodeId, text, replaceName),
    );
    return r !== null;
  }

  async function removeAttribute(nodeId: number, name: string) {
    const d = domains();
    if (!d) return false;
    const r = await run("removeAttribute", () => d.dom.removeAttribute(nodeId, name));
    return r !== null;
  }

  async function setTextNodeValue(nodeId: number, value: string) {
    const d = domains();
    if (!d) return false;
    const r = await run("setNodeValue", () => d.dom.setNodeValue(nodeId, value));
    return r !== null;
  }

  async function setOuterHTML(nodeId: number, outerHTML: string) {
    const d = domains();
    if (!d) return false;
    const r = await run("setOuterHTML", () => d.dom.setOuterHTML(nodeId, outerHTML));
    return r !== null;
  }

  async function removeNode(nodeId: number) {
    const d = domains();
    if (!d) return false;
    const r = await run("removeNode", () => d.dom.removeNode(nodeId));
    return r !== null;
  }

  async function duplicateNode(nodeId: number) {
    const d = domains();
    if (!d) return false;
    const r = await run("duplicateNode", async () => {
      const html = await d.dom.getOuterHTML(nodeId);
      const result = await d.client.send<{ result: { value?: unknown } }>("DOM.resolveNode", {
        nodeId,
      });
      const objectId = (result as unknown as { object?: { objectId?: string } }).object?.objectId;
      if (!objectId) throw new Error("Could not resolve node");
      await d.client.send("Runtime.callFunctionOn", {
        objectId,
        functionDeclaration: `function() {
          const clone = this.cloneNode(true);
          this.parentNode?.insertBefore(clone, this.nextSibling);
        }`,
      });
      return html;
    });
    return r !== null;
  }

  async function scrollIntoView(nodeId: number) {
    const d = domains();
    if (!d) return false;
    const r = await run("scrollIntoView", () => d.dom.scrollIntoViewIfNeeded(nodeId));
    return r !== null;
  }

  async function getOuterHTML(nodeId: number): Promise<string | null> {
    const d = domains();
    if (!d) return null;
    return run("getOuterHTML", () => d.dom.getOuterHTML(nodeId));
  }

  async function getCSSSelector(nodeId: number): Promise<string | null> {
    const d = domains();
    if (!d) return null;
    return run("getCSSSelector", async () => {
      const result = await d.client.send<{ object: { objectId: string } }>("DOM.resolveNode", {
        nodeId,
      });
      const objectId = result.object.objectId;
      const call = await d.client.send<{ result: { value?: string } }>("Runtime.callFunctionOn", {
        objectId,
        functionDeclaration: `function() {
          if (!(this instanceof Element)) return '';
          if (this.id) return '#' + CSS.escape(this.id);
          const parts = [];
          let el = this;
          while (el && el.nodeType === 1 && el !== document.documentElement) {
            let part = el.localName;
            if (el.classList.length) {
              part += '.' + Array.from(el.classList).map(c => CSS.escape(c)).join('.');
            } else if (el.parentElement) {
              const siblings = Array.from(el.parentElement.children).filter(c => c.localName === el.localName);
              if (siblings.length > 1) {
                part += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
              }
            }
            parts.unshift(part);
            el = el.parentElement;
          }
          return parts.join(' > ');
        }`,
        returnByValue: true,
      });
      return call.result.value ?? "";
    });
  }

  async function getXPath(nodeId: number): Promise<string | null> {
    const d = domains();
    if (!d) return null;
    return run("getXPath", async () => {
      const result = await d.client.send<{ object: { objectId: string } }>("DOM.resolveNode", {
        nodeId,
      });
      const objectId = result.object.objectId;
      const call = await d.client.send<{ result: { value?: string } }>("Runtime.callFunctionOn", {
        objectId,
        functionDeclaration: `function() {
          if (this.nodeType !== 1) return '';
          if (this.id) return '//*[@id="' + this.id + '"]';
          const parts = [];
          let el = this;
          while (el && el.nodeType === 1) {
            let idx = 1;
            let sib = el.previousElementSibling;
            while (sib) {
              if (sib.localName === el.localName) idx++;
              sib = sib.previousElementSibling;
            }
            parts.unshift(el.localName + '[' + idx + ']');
            el = el.parentElement;
          }
          return '/' + parts.join('/');
        }`,
        returnByValue: true,
      });
      return call.result.value ?? "";
    });
  }

  async function setStyleText(
    styleSheetId: string,
    range: SourceRange,
    text: string,
  ): Promise<CSSStyle | null> {
    const d = domains();
    if (!d) return null;
    return run("setStyleText", async () => {
      const styles = await d.css.setStyleTexts([{ styleSheetId, range, text }]);
      return styles[0] ?? null;
    });
  }

  async function setInlineStyle(nodeId: number, cssText: string): Promise<boolean> {
    const d = domains();
    if (!d) return false;
    const r = await run("setInlineStyle", () => d.dom.setAttributeValue(nodeId, "style", cssText));
    return r !== null;
  }

  async function ensureInspectorStyleSheet(frameId: string): Promise<string | null> {
    const d = domains();
    if (!d) return null;
    return run("createStyleSheet", () => d.css.createStyleSheet(frameId));
  }

  async function addRule(
    styleSheetId: string,
    selector: string,
    body: string,
    location?: SourceRange,
  ) {
    const d = domains();
    if (!d) return null;
    return run("addRule", () =>
      d.css.addRule(
        styleSheetId,
        `${selector} { ${body} }`,
        location ?? { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 },
      ),
    );
  }

  function clearLastError() {
    lastError.value = null;
  }

  async function refreshNode(nodeId: number) {
    const d = domains();
    if (!d) return;
    try {
      await d.dom.requestChildNodes(nodeId, 1);
    } catch {}
    store.selectNode(nodeId);
  }

  return {
    isMutating,
    lastError,
    clearLastError,

    setAttribute,
    setAttributesAsText,
    removeAttribute,
    setTextNodeValue,
    setOuterHTML,
    removeNode,
    duplicateNode,
    scrollIntoView,
    getOuterHTML,
    getCSSSelector,
    getXPath,

    setStyleText,
    setInlineStyle,
    ensureInspectorStyleSheet,
    addRule,

    refreshNode,
  };
}
