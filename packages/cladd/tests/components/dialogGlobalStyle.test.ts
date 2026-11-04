import { expect, test } from 'vite-plus/test';
import { defineComponent, h, nextTick, ref } from 'vue';

import Dialog from '../../src/components/Dialog.vue';
import { mountTree } from '../support/mountTree.ts';

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 60));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextTick();
}

function restoreScrollBehavior(value: string): void {
  if (value) {
    document.documentElement.style.scrollBehavior = value;
  } else {
    document.documentElement.style.removeProperty('scroll-behavior');
  }
}

function removeDialogNodes(): void {
  document.body
    .querySelectorAll('.cladd-dialog')
    .forEach((node) => node.remove());
}

test('preserves consumer scroll behavior across nested dialog close ordering', async () => {
  const previous = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'smooth';
  const outerOpen = ref(true);
  const innerOpen = ref(true);
  const harness = defineComponent({
    setup() {
      return () =>
        h(
          Dialog,
          {
            open: outerOpen.value,
            root: false,
            title: 'Outer',
          },
          {
            default: () =>
              h(Dialog, {
                open: innerOpen.value,
                root: false,
                title: 'Inner',
              }),
          },
        );
    },
  });
  const mounted = mountTree(h(harness));

  try {
    await settle();
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');

    innerOpen.value = false;
    await settle();
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');

    outerOpen.value = false;
    await settle();
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');
  } finally {
    mounted.app.unmount();
    mounted.root.remove();
    removeDialogNodes();
    restoreScrollBehavior(previous);
  }
});

test('preserves consumer scroll behavior when nested dialogs unmount open', async () => {
  const previous = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'smooth';
  const harness = defineComponent({
    setup() {
      return () =>
        h(
          Dialog,
          { open: true, root: false, title: 'Outer' },
          {
            default: () =>
              h(Dialog, { open: true, root: false, title: 'Inner' }),
          },
        );
    },
  });
  const mounted = mountTree(h(harness));

  try {
    await settle();
    mounted.app.unmount();
    await settle();
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');
  } finally {
    mounted.root.remove();
    removeDialogNodes();
    restoreScrollBehavior(previous);
  }
});
