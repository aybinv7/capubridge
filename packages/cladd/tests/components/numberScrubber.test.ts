import { expect, test } from 'vite-plus/test';
import { h, nextTick, ref } from 'vue';

import NumberScrubber from '../../src/components/NumberScrubber.vue';
import { byTestId, click, mountTree } from '../support/mountTree.ts';

test('renders the formatted value and the scrubber indicator', () => {
  const mounted = mountTree(
    h(NumberScrubber, {
      'data-testid': 'scrubber',
      displayValue: (value: number) => `${value} px`,
      modelValue: 12,
    }),
  );

  const root = byTestId(mounted.root, 'scrubber');
  expect(root.textContent).toContain('12 px');
  expect(root.className).toContain('cladd-number-scrubber');
  expect(root.className).toContain('cursor-ew-resize');
  expect(root.querySelector('svg')).not.toBeNull();
  mounted.app.unmount();
});

test('drops the drag affordance when disabled or read-only', () => {
  const mounted = mountTree(
    h('div', null, [
      h(NumberScrubber, { 'data-testid': 'off', disabled: true }),
      h(NumberScrubber, { 'data-testid': 'ro', readOnly: true }),
    ]),
  );

  expect(byTestId(mounted.root, 'off').className).not.toContain(
    'cursor-ew-resize',
  );
  expect(byTestId(mounted.root, 'ro').className).not.toContain(
    'cursor-ew-resize',
  );
  mounted.app.unmount();
});

test('switches to an editable input on click and commits on Enter', async () => {
  const value = ref(4);
  const mounted = mountTree(
    h(NumberScrubber, {
      'data-testid': 'scrubber',
      max: 10,
      min: 0,
      'onUpdate:modelValue': (next?: number) => (value.value = next ?? 0),
      step: 1,
    }),
  );

  await click(byTestId(mounted.root, 'scrubber'));
  await nextTick();

  const input = mounted.root.querySelector('input');
  expect(input).not.toBeNull();
  if (!input) return;

  input.value = '7';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
  );
  await nextTick();

  expect(value.value).toBe(7);
  mounted.app.unmount();
});

test('clamps and rounds a committed value to min, max and step', async () => {
  const value = ref(0);
  const mounted = mountTree(
    h(NumberScrubber, {
      'data-testid': 'scrubber',
      max: 10,
      min: 2,
      'onUpdate:modelValue': (next?: number) => (value.value = next ?? 0),
      step: 5,
    }),
  );

  await click(byTestId(mounted.root, 'scrubber'));
  await nextTick();

  const input = mounted.root.querySelector('input');
  if (!input) throw new Error('editor did not open');

  input.value = '99';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
  );
  await nextTick();

  expect(value.value).toBe(10);
  mounted.app.unmount();
});
