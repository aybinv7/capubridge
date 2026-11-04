import { expect, test } from 'vite-plus/test';
import { h, ref } from 'vue';

import ColorEditor from '../../src/components/ColorEditor.vue';
import ColorPicker from '../../src/components/ColorPicker.vue';
import { byTestId, mountTree } from '../support/mountTree.ts';

function part(root: HTMLElement, name: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(`[data-part="${name}"]`);
  if (!found) throw new Error(`missing [data-part="${name}"]`);
  return found;
}

test('renders the editor area, hue and alpha tracks', () => {
  const mounted = mountTree(
    h(ColorEditor, { 'data-testid': 'editor', modelValue: '#4f46e5' }),
  );

  const root = byTestId(mounted.root, 'editor');
  expect(root.className).toContain('cladd-coloreditor');
  expect(part(root, 'area')).not.toBeNull();
  expect(part(root, 'hue')).not.toBeNull();
  expect(part(root, 'alpha')).not.toBeNull();

  const areaThumb = part(root, 'area-thumb');
  expect(areaThumb.getAttribute('role')).toBe('slider');
  expect(areaThumb.getAttribute('aria-valuetext')).toMatch(/^S \d+%, B \d+%$/u);
  mounted.app.unmount();
});

test('hides the alpha track and the swatch row when switched off', () => {
  const mounted = mountTree(
    h(ColorEditor, {
      alpha: false,
      'data-testid': 'editor',
      modelValue: '#ff0000',
    }),
  );

  const root = byTestId(mounted.root, 'editor');
  expect(root.querySelector('[data-part="alpha"]')).toBeNull();
  expect(root.querySelector('[data-part="swatches"]')).toBeNull();
  mounted.app.unmount();
});

test('renders one swatch button per preset', () => {
  const mounted = mountTree(
    h(ColorEditor, {
      'data-testid': 'editor',
      modelValue: '#ff0000',
      swatches: ['#ef4444', '#22c55e', '#6366f1'],
    }),
  );

  const swatches = part(byTestId(mounted.root, 'editor'), 'swatches');
  expect(swatches.querySelectorAll('button')).toHaveLength(3);
  mounted.app.unmount();
});

test('only shows the solid/gradient toolbar in gradient mode', () => {
  const solid = mountTree(
    h(ColorEditor, { 'data-testid': 'solid', modelValue: '#ff0000' }),
  );
  expect(
    byTestId(solid.root, 'solid').querySelector('[data-part="toolbar"]'),
  ).toBeNull();
  solid.app.unmount();

  const gradient = mountTree(
    h(ColorEditor, {
      'data-testid': 'gradient',
      gradient: true,
      modelValue: '#ff0000',
    }),
  );
  expect(
    byTestId(gradient.root, 'gradient').querySelector('[data-part="toolbar"]'),
  ).not.toBeNull();
  gradient.app.unmount();
});

test('keyboard moves the hue thumb and emits a change', async () => {
  const emitted = ref('');
  const mounted = mountTree(
    h(ColorEditor, {
      'data-testid': 'editor',
      onChange: (value: { css: string }) => (emitted.value = value.css),
    }),
  );

  const thumb = part(byTestId(mounted.root, 'editor'), 'hue').querySelector(
    '[role="slider"]',
  );
  expect(thumb).not.toBeNull();

  thumb?.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }),
  );
  expect(emitted.value).not.toBe('');
  mounted.app.unmount();
});

test('shows the hex on the picker trigger and the placeholder when empty', () => {
  const mounted = mountTree(
    h('div', null, [
      h(ColorPicker, { 'data-testid': 'filled', modelValue: '#22d3ee' }),
      h(ColorPicker, {
        'data-testid': 'empty',
        placeholder: 'No colour',
      }),
    ]),
  );

  const filled = byTestId(mounted.root, 'filled');
  expect(filled.className).toContain('cladd-colorpicker');
  expect(part(filled, 'value').textContent?.trim()).toBe('#22D3EE');
  expect(part(filled, 'swatch')).not.toBeNull();

  const empty = byTestId(mounted.root, 'empty');
  expect(part(empty, 'value').textContent?.trim()).toBe('No colour');
  mounted.app.unmount();
});

test('labels a gradient value on the picker trigger', () => {
  const mounted = mountTree(
    h(ColorPicker, {
      'data-testid': 'picker',
      gradient: true,
      gradientLabel: 'Gradient',
      modelValue: 'linear-gradient(90deg, #f97316 0%, #a855f7 100%)',
    }),
  );

  expect(
    part(byTestId(mounted.root, 'picker'), 'value').textContent?.trim(),
  ).toBe('Gradient');
  mounted.app.unmount();
});
