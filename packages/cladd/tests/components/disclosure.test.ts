import { expect, test } from 'vite-plus/test';
import { defineComponent, h, nextTick, ref } from 'vue';

import {
  AccordionIndicator,
  AccordionItem,
  AccordionPanel,
  AccordionRoot,
  AccordionTrigger,
  CollapsibleIndicator,
  CollapsiblePanel,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '../../src/index.ts';
import { byTestId, click, mountTree } from '../support/mountTree.ts';

test('CollapsibleRoot starts closed and opens on trigger click', async () => {
  const mounted = mountTree(
    h(CollapsibleRoot, null, () => [
      h(CollapsibleTrigger, null, () =>
        h('button', { 'data-testid': 'trigger' }, 'Toggle'),
      ),
      h(CollapsiblePanel, { 'data-testid': 'panel' }, () => 'Panel content'),
    ]),
  );

  expect(mounted.root.querySelector('[data-testid="panel"]')).toBeNull();
  expect(byTestId(mounted.root, 'trigger').getAttribute('aria-expanded')).toBe(
    'false',
  );

  await click(byTestId(mounted.root, 'trigger'));

  const panel = mounted.root.querySelector('[data-testid="panel"]');
  expect(panel).not.toBeNull();
  expect(panel?.textContent).toBe('Panel content');
  expect(byTestId(mounted.root, 'trigger').getAttribute('aria-expanded')).toBe(
    'true',
  );
  mounted.app.unmount();
});

test('CollapsibleRoot honors defaultOpen and keepMounted', () => {
  const mounted = mountTree(
    h(CollapsibleRoot, { defaultOpen: true }, () => [
      h(
        CollapsiblePanel,
        { 'data-testid': 'panel', keepMounted: true },
        () => 'content',
      ),
    ]),
  );

  const panel = byTestId(mounted.root, 'panel');
  expect(panel.getAttribute('data-open')).toBe('true');
  mounted.app.unmount();
});

test('CollapsibleIndicator exposes open/disabled through its scoped slot', async () => {
  const mounted = mountTree(
    h(CollapsibleRoot, null, () => [
      h(CollapsibleTrigger, null, () =>
        h('button', { 'data-testid': 'trigger' }, 'Toggle'),
      ),
      h(
        CollapsibleIndicator,
        { 'data-testid': 'indicator' },
        {
          default: ({ open }: { open: boolean }) =>
            open ? 'expanded' : 'collapsed',
        },
      ),
    ]),
  );

  expect(byTestId(mounted.root, 'indicator').textContent).toBe('collapsed');
  await click(byTestId(mounted.root, 'trigger'));
  expect(byTestId(mounted.root, 'indicator').textContent).toBe('expanded');
  mounted.app.unmount();
});

test('AccordionRoot keeps a single item open by default and closes it on re-toggle', async () => {
  const mounted = mountTree(
    h(AccordionRoot, { defaultValue: 'one' }, () => [
      h(AccordionItem, { value: 'one' }, () => [
        h(AccordionTrigger, null, () =>
          h('button', { 'data-testid': 'trigger-one' }, 'One'),
        ),
        h(AccordionPanel, { 'data-testid': 'panel-one' }, () => 'One content'),
      ]),
      h(AccordionItem, { value: 'two' }, () => [
        h(AccordionTrigger, null, () =>
          h('button', { 'data-testid': 'trigger-two' }, 'Two'),
        ),
        h(AccordionPanel, { 'data-testid': 'panel-two' }, () => 'Two content'),
      ]),
    ]),
  );

  expect(
    mounted.root.querySelector('[data-testid="panel-one"]'),
  ).not.toBeNull();
  expect(mounted.root.querySelector('[data-testid="panel-two"]')).toBeNull();

  await click(byTestId(mounted.root, 'trigger-two'));
  expect(mounted.root.querySelector('[data-testid="panel-one"]')).toBeNull();
  expect(
    mounted.root.querySelector('[data-testid="panel-two"]'),
  ).not.toBeNull();

  await click(byTestId(mounted.root, 'trigger-two'));
  expect(mounted.root.querySelector('[data-testid="panel-two"]')).toBeNull();
  mounted.app.unmount();
});

test('AccordionRoot with multiple keeps every opened item open independently', async () => {
  const mounted = mountTree(
    h(AccordionRoot, { defaultValue: ['one'], multiple: true }, () => [
      h(AccordionItem, { value: 'one' }, () => [
        h(AccordionTrigger, null, () =>
          h('button', { 'data-testid': 'trigger-one' }, 'One'),
        ),
        h(AccordionPanel, { 'data-testid': 'panel-one' }, () => 'One content'),
      ]),
      h(AccordionItem, { value: 'two' }, () => [
        h(AccordionTrigger, null, () =>
          h('button', { 'data-testid': 'trigger-two' }, 'Two'),
        ),
        h(AccordionPanel, { 'data-testid': 'panel-two' }, () => 'Two content'),
      ]),
    ]),
  );

  await click(byTestId(mounted.root, 'trigger-two'));
  expect(
    mounted.root.querySelector('[data-testid="panel-one"]'),
  ).not.toBeNull();
  expect(
    mounted.root.querySelector('[data-testid="panel-two"]'),
  ).not.toBeNull();
  mounted.app.unmount();
});

test('AccordionRoot stays controlled when its bound value clears to undefined', async () => {
  const value = ref<string | undefined>('one');
  const harness = defineComponent({
    setup() {
      return () =>
        h(
          AccordionRoot,
          {
            'onUpdate:value': (next: string | string[] | undefined) =>
              (value.value = next as string | undefined),
            value: value.value,
          },
          () => [
            h(AccordionItem, { value: 'one' }, () => [
              h(AccordionTrigger, null, () =>
                h('button', { 'data-testid': 'trigger-one' }, 'One'),
              ),
              h(
                AccordionPanel,
                { 'data-testid': 'panel-one' },
                () => 'One content',
              ),
            ]),
          ],
        );
    },
  });
  const mounted = mountTree(h(harness));

  // Clearing the bound value to `undefined` (everything closed) must not
  // flip the accordion to uncontrolled — clicking afterward should still
  // update the parent's ref rather than silently falling back to internal
  // state.
  value.value = undefined;
  await nextTick();
  expect(mounted.root.querySelector('[data-testid="panel-one"]')).toBeNull();

  await click(byTestId(mounted.root, 'trigger-one'));
  expect(value.value).toBe('one');
  expect(
    mounted.root.querySelector('[data-testid="panel-one"]'),
  ).not.toBeNull();
  mounted.app.unmount();
});

test('a disabled AccordionItem does not toggle', async () => {
  const mounted = mountTree(
    h(AccordionRoot, null, () => [
      h(AccordionItem, { disabled: true, value: 'one' }, () => [
        h(AccordionTrigger, null, () =>
          h('button', { 'data-testid': 'trigger-one' }, 'One'),
        ),
        h(AccordionPanel, { 'data-testid': 'panel-one' }, () => 'One content'),
      ]),
    ]),
  );

  await click(byTestId(mounted.root, 'trigger-one'));
  expect(mounted.root.querySelector('[data-testid="panel-one"]')).toBeNull();
  mounted.app.unmount();
});

test('AccordionIndicator is the same component as CollapsibleIndicator', () => {
  expect(AccordionIndicator).toBe(CollapsibleIndicator);
});
