import { expect, test } from 'vite-plus/test';
import { h, nextTick, ref } from 'vue';

import NumberField from '../../src/components/NumberField.vue';
import { byTestId, click, mountTree } from '../support/mountTree.ts';

function part(root: HTMLElement, name: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(`[data-part="${name}"]`);
  if (!found) throw new Error(`missing [data-part="${name}"]`);
  return found;
}

test('steps the value with the plus and minus buttons', async () => {
  const value = ref(0);
  // Uncontrolled: `mountTree` renders a fixed vnode, so a `modelValue` prop
  // would never update and every press would compute from the same number.
  const mounted = mountTree(
    h(NumberField, {
      'data-testid': 'field',
      max: 4,
      min: 0,
      onChange: (next: number) => (value.value = next),
      step: 2,
    }),
  );

  const root = byTestId(mounted.root, 'field');
  await click(part(root, 'increase'));
  expect(value.value).toBe(2);

  await click(part(root, 'increase'));
  expect(value.value).toBe(4);

  await click(part(root, 'decrease'));
  expect(value.value).toBe(2);
  mounted.app.unmount();
});

test('disables each button at its bound', () => {
  const mounted = mountTree(
    h('div', null, [
      h(NumberField, {
        'data-testid': 'at-min',
        max: 5,
        min: 0,
        modelValue: 0,
      }),
      h(NumberField, {
        'data-testid': 'at-max',
        max: 5,
        min: 0,
        modelValue: 5,
      }),
    ]),
  );

  expect(part(byTestId(mounted.root, 'at-min'), 'decrease').disabled).toBe(
    true,
  );
  expect(part(byTestId(mounted.root, 'at-min'), 'increase').disabled).toBe(
    false,
  );
  expect(part(byTestId(mounted.root, 'at-max'), 'increase').disabled).toBe(
    true,
  );
  mounted.app.unmount();
});

test('snaps a typed value to step and clamps it on blur', async () => {
  const value = ref(0);
  const mounted = mountTree(
    h(NumberField, {
      'data-testid': 'field',
      max: 10,
      min: 1,
      onChange: (next: number) => (value.value = next),
      step: 3,
    }),
  );

  const input = byTestId(mounted.root, 'field').querySelector('input');
  if (!input) throw new Error('no editable input');

  input.value = '9';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  await nextTick();

  // min 1 + round((9 - 1) / 3) * 3 = 10
  expect(value.value).toBe(10);
  mounted.app.unmount();
});

test('renders a read-only chip instead of an input when input is false', () => {
  const mounted = mountTree(
    h(NumberField, { 'data-testid': 'field', input: false, modelValue: 7 }),
  );

  const root = byTestId(mounted.root, 'field');
  expect(root.querySelector('input')).toBeNull();
  expect(root.textContent).toContain('7');
  mounted.app.unmount();
});
