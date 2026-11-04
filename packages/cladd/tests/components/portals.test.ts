import { expect, test } from 'vite-plus/test';
import { defineComponent, h, nextTick } from 'vue';

import {
  toastOpenedClasses,
  toastSurfaceClasses,
} from '../../src/components/toast.contracts.ts';
import {
  Toast,
  ToastRoot,
  ToastTrigger,
  CladdProvider,
  useDialog,
  useToast,
} from '../../src/index.ts';
import { byTestId, click, mountTree } from '../support/mountTree.ts';

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) =>
    requestAnimationFrame(() => resolve(undefined)),
  );
  await nextTick();
}

/** Mounts `CladdProvider` with a child that hands its portal API back to the test. */
function mountWithApi<T>(useApi: () => T) {
  let api!: T;
  const consumer = defineComponent({
    setup() {
      api = useApi();
      return () => h('span');
    },
  });
  const mounted = mountTree(
    h(CladdProvider, null, { default: () => h(consumer) }),
  );
  return { api, mounted };
}

test('locks the Cladd toast stacking utility strings', () => {
  expect(toastSurfaceClasses).toBe(
    'cladd-toast fixed right-safe-4 bottom-safe-4 z-50 max-w-full origin-bottom rounded-cladd-toast',
  );
  // Each toast reacts to how many un-closing toasts follow it — three deep and it hides.
  expect(toastOpenedClasses).toContain(
    'has-[+.cladd-toast+.cladd-toast+.cladd-toast:not(.toast-closing)]:opacity-0',
  );
  expect(toastOpenedClasses).toContain(
    'has-[+.cladd-toast:not(.toast-closing)]:scale-90',
  );
});

test('CladdProvider renders the dialogs portal and useDialog drives it', async () => {
  const { api, mounted } = mountWithApi(() => useDialog());
  const confirmed: boolean[] = [];

  expect(document.body.querySelector('[role="dialog"]')).toBeNull();

  api.confirm({
    confirmButtonText: 'Delete',
    onConfirm: (value) => confirmed.push(value),
    text: 'This cannot be undone.',
    title: 'Delete target?',
  });
  await settle();

  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog?.textContent).toContain('Delete target?');
  expect(dialog?.textContent).toContain('This cannot be undone.');

  const confirmButton = document.body.querySelector<HTMLButtonElement>(
    '[data-part="confirm"]',
  );
  if (confirmButton) await click(confirmButton);
  await settle();

  expect(confirmed).toEqual([true]);
  mounted.app.unmount();
  mounted.root.remove();
});

test('useDialog alert renders a single confirm affordance', async () => {
  const { api, mounted } = mountWithApi(() => useDialog());

  api.alert({ text: 'Target detached.', title: 'Done' });
  await settle();

  expect(
    document.body.querySelector('[data-part="confirm"]')?.textContent?.trim(),
  ).toBe('Ok');
  expect(document.body.querySelector('[data-part="cancel"]')).toBeNull();

  mounted.app.unmount();
  mounted.root.remove();
});

test('drives a declarative toast through the ToastRoot compound', async () => {
  const mounted = mountTree(
    h(CladdProvider, null, {
      default: () =>
        h(ToastRoot, null, {
          default: () => [
            h(ToastTrigger, null, {
              default: () =>
                h(
                  'button',
                  { 'data-testid': 'toast-trigger', type: 'button' },
                  'Go',
                ),
            }),
            h(Toast, { text: 'Reconnected', timeout: 0, title: 'Device' }),
          ],
        }),
    }),
  );

  expect(document.body.querySelector('.cladd-toast')).toBeNull();

  await click(byTestId(mounted.root, 'toast-trigger'));
  await settle();

  expect(document.body.querySelector('.cladd-toast')?.textContent).toContain(
    'Reconnected',
  );

  mounted.app.unmount();
  mounted.root.remove();
});

test('CladdProvider renders the toasts portal and useToast queues onto it', async () => {
  const { api, mounted } = mountWithApi(() => useToast());

  api({ text: 'IndexedDB cleared', timeout: 0, title: 'Storage' });
  api({ text: 'Cache API cleared', timeout: 0, title: 'Storage' });
  await settle();

  const toasts = document.body.querySelectorAll('.cladd-toast');
  expect(toasts).toHaveLength(2);
  expect(document.body.textContent).toContain('IndexedDB cleared');
  expect(document.body.textContent).toContain('Cache API cleared');

  mounted.app.unmount();
  mounted.root.remove();
});
