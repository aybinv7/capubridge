const phrasingElements = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'button',
  'cite',
  'code',
  'data',
  'dfn',
  'em',
  'i',
  'kbd',
  'label',
  'mark',
  'output',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
]);

export function resolveSurfaceInnerElement(
  rootElement: unknown,
): 'div' | 'span' {
  return typeof rootElement === 'string' && phrasingElements.has(rootElement)
    ? 'span'
    : 'div';
}
