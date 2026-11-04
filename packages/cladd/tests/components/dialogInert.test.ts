import { expect, test } from 'vite-plus/test';
import { h, nextTick } from 'vue';

import Dialog from '../../src/components/Dialog.vue';
import Input from '../../src/components/Input.vue';
import { mountTree } from '../support/mountTree.ts';

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 60));
  await nextTick();
}

test('makes the inert container inert while open and clears it on close', async () => {
  const app = document.createElement('div');
  app.className = 'app-container';
  document.body.append(app);

  const mounted = mountTree(h(Dialog, { open: true, title: 'Confirm' }));
  await settle();
  expect(app.inert).toBe(true);

  mounted.app.unmount();
  await settle();
  expect(app.inert).toBe(false);

  app.remove();
  mounted.root.remove();
});

test('releases the inert container while a popover is still mounted', async () => {
  const app = document.createElement('div');
  app.className = 'app-container';
  document.body.append(app);
  const lingeringPopover = document.createElement('div');
  lingeringPopover.className = 'cladd-popover';
  document.body.append(lingeringPopover);

  const mounted = mountTree(h(Dialog, { open: true, title: 'Confirm' }));
  await settle();
  expect(app.inert).toBe(true);

  mounted.app.unmount();
  await settle();
  expect(app.inert).toBe(false);

  lingeringPopover.remove();
  app.remove();
  mounted.root.remove();
});

test('keeps the inert container while another dialog is still open', async () => {
  const app = document.createElement('div');
  app.className = 'app-container';
  document.body.append(app);

  const outer = mountTree(h(Dialog, { open: true, title: 'Outer' }));
  const inner = mountTree(h(Dialog, { open: true, title: 'Inner' }));
  await settle();
  expect(app.inert).toBe(true);

  inner.app.unmount();
  await settle();
  expect(app.inert).toBe(true);

  outer.app.unmount();
  await settle();
  expect(app.inert).toBe(false);

  app.remove();
  inner.root.remove();
  outer.root.remove();
});

test('honours a custom inertContainer selector', async () => {
  const shell = document.createElement('div');
  shell.id = 'shell';
  document.body.append(shell);

  const mounted = mountTree(
    h(Dialog, { inertContainer: '#shell', open: true, title: 'Confirm' }),
  );
  await settle();
  expect(shell.inert).toBe(true);

  mounted.app.unmount();
  await settle();
  shell.remove();
  mounted.root.remove();
});

test('renders a polymorphic inner control when inputComponent is set', () => {
  const mounted = mountTree(
    h(Input, { 'data-testid': 'field', inputComponent: 'textarea' }),
  );

  expect(mounted.root.querySelector('textarea')).not.toBeNull();
  expect(mounted.root.querySelector('input')).toBeNull();
  mounted.app.unmount();
});
