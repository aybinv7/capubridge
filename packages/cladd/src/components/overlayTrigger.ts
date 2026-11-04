import { cloneVNode, Comment, Fragment, Text, type VNode } from 'vue';

function findElementNode(nodes: readonly VNode[]): VNode | undefined {
  for (const node of nodes) {
    if (node.type === Comment) continue;
    if (
      node.type === Text &&
      typeof node.children === 'string' &&
      !node.children.trim()
    )
      continue;
    if (node.type === Text) return undefined;
    if (node.type === Fragment && Array.isArray(node.children)) {
      const nested = findElementNode(node.children as VNode[]);
      if (nested) return nested;
      continue;
    }
    return node;
  }

  return undefined;
}

export function cloneTriggerNode(
  nodes: readonly VNode[] | undefined,
  extraProps: Record<string, unknown>,
): VNode | undefined {
  const node = nodes ? findElementNode(nodes) : undefined;
  return node ? cloneVNode(node, extraProps, true) : undefined;
}
