/** The caret's offset in the plain text of a contenteditable element, or its length when unknown. */
export function caretOffset(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return element.innerText.length;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.endContainer)) return element.innerText.length;
  const before = document.createRange();
  before.selectNodeContents(element);
  before.setEnd(range.endContainer, range.endOffset);
  return before.toString().length;
}

/** Puts the caret at `offset` characters into a contenteditable element. */
export function placeCaret(element: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) return;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}
