import { expect, test } from 'vite-plus/test';
import { h } from 'vue';

import CladdProvider from '../../src/components/CladdProvider.vue';
import StatusDot from '../../src/components/StatusDot.vue';
import { mountTree } from '../support/mountTree.ts';

function dot(root: HTMLElement) {
  const element = root.querySelector<HTMLElement>('.cladd-status-dot');
  if (!element) throw new Error('Missing status dot');
  return element;
}

function render(props: Record<string, unknown> = {}) {
  const tree = mountTree(h(StatusDot, props));
  return { ...tree, element: dot(tree.root) };
}

test('a dot without a label is decorative and quiet', () => {
  const { app, root, element } = render();

  expect(element.tagName).toBe('SPAN');
  expect(element.getAttribute('aria-hidden')).toBe('true');
  expect(element.hasAttribute('role')).toBe(false);
  expect(element.className).toContain('size-1.5');
  expect(element.className).toContain('bg-cladd-fg-softer');
  expect(element.className).not.toContain('cladd-color-');
  expect(element.dataset.variant).toBe('solid');
  app.unmount();
  root.remove();
});

test('a labelled dot is an image named by its label', () => {
  const { app, root, element } = render({ label: 'Online', color: 'green' });

  expect(element.getAttribute('role')).toBe('img');
  expect(element.getAttribute('aria-label')).toBe('Online');
  expect(element.hasAttribute('aria-hidden')).toBe(false);
  expect(element.className).toContain('cladd-color-green');
  expect(element.className).toContain('bg-cladd-primary');
  expect(element.dataset.color).toBe('green');
  app.unmount();
  root.remove();
});

test('hollow draws a ring instead of a fill', () => {
  const neutral = render({ variant: 'hollow' });
  expect(neutral.element.className).toContain('ring-cladd-fg-softer');
  expect(neutral.element.className).not.toContain('bg-cladd');
  neutral.app.unmount();
  neutral.root.remove();

  const accent = render({ variant: 'hollow', color: 'red' });
  expect(accent.element.className).toContain('ring-cladd-primary');
  expect(accent.element.dataset.variant).toBe('hollow');
  accent.app.unmount();
  accent.root.remove();
});

test('sizes map to 5, 6 and 8 px', () => {
  for (const [size, token] of [
    ['xs', 'size-1.25'],
    ['sm', 'size-1.5'],
    ['md', 'size-2'],
  ] as const) {
    const { app, root, element } = render({ size });
    expect(element.className).toContain(token);
    app.unmount();
    root.remove();
  }
});

test('pulse is motion-safe only', () => {
  const { app, root, element } = render({ pulse: true });

  expect(element.className).toContain('motion-safe:animate-pulse');
  expect(element.dataset.pulse).toBe('true');
  app.unmount();
  root.remove();
});

test('consumer classes and attributes reach the root', () => {
  const { app, root, element } = render({
    class: 'ml-2',
    'data-testid': 'probe',
  });

  expect(element.className).toContain('ml-2');
  expect(element.dataset.testid).toBe('probe');
  app.unmount();
  root.remove();
});

test('reads provider defaults', () => {
  const { app, root } = mountTree(
    h(
      CladdProvider,
      { defaults: { StatusDot: { size: 'md', variant: 'hollow' } } },
      { default: () => h(StatusDot) },
    ),
  );

  const element = dot(root);
  expect(element.className).toContain('size-2');
  expect(element.dataset.variant).toBe('hollow');
  app.unmount();
  root.remove();
});
