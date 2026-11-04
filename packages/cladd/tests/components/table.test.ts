import { expect, test } from 'vite-plus/test';
import { h } from 'vue';

import Table from '../../src/components/Table.vue';
import TableBody from '../../src/components/TableBody.vue';
import TableCaption from '../../src/components/TableCaption.vue';
import TableCell from '../../src/components/TableCell.vue';
import TableFooter from '../../src/components/TableFooter.vue';
import TableHead from '../../src/components/TableHead.vue';
import TableHeader from '../../src/components/TableHeader.vue';
import TableRow from '../../src/components/TableRow.vue';
import { mountTree } from '../support/mountTree.ts';

function rows() {
  return h(TableBody, null, {
    default: () => [
      h(TableRow, null, {
        default: () => [h(TableCell, null, { default: () => 'Ada' })],
      }),
    ],
  });
}

test('preserves valid table ancestry', () => {
  const { app, root } = mountTree(
    h(Table, null, {
      default: () => [
        h(TableCaption, null, { default: () => 'Team' }),
        h(TableHeader, null, {
          default: () =>
            h(TableRow, null, {
              default: () => h(TableHead, null, { default: () => 'Name' }),
            }),
        }),
        rows(),
      ],
    }),
  );

  expect(root.querySelector('table > caption')?.textContent).toBe('Team');
  expect(root.querySelector('table > thead > tr > th')?.textContent).toBe(
    'Name',
  );
  expect(root.querySelector('table > tbody > tr > td')?.textContent).toBe(
    'Ada',
  );
  app.unmount();
  root.remove();
});

test('headers keep native scope and numeric alignment', () => {
  const { app, root } = mountTree(
    h(Table, null, {
      default: () => [
        h(TableHeader, null, {
          default: () =>
            h(TableRow, null, {
              default: () => [
                h(TableHead, { scope: 'row' }, { default: () => 'Row' }),
                h(TableHead, { numeric: true }, { default: () => 'Total' }),
              ],
            }),
        }),
        rows(),
      ],
    }),
  );

  const heads = root.querySelectorAll('th');
  expect(heads[0].getAttribute('scope')).toBe('row');
  expect(heads[1].className).toContain('text-right');
  expect(heads[1].className).toContain('tabular-nums');
  app.unmount();
  root.remove();
});

test('container owns horizontal overflow', () => {
  const { app, root } = mountTree(h(Table, null, { default: () => rows() }));

  expect(
    root.querySelector('[data-slot="table-container"]')?.className,
  ).toContain('overflow-x-auto');
  app.unmount();
  root.remove();
});

test('sticky headers stay inside the container', () => {
  const { app, root } = mountTree(
    h(
      Table,
      { stickyHeader: true },
      {
        default: () =>
          h(
            TableHeader,
            { sticky: true },
            {
              default: () =>
                h(TableRow, null, {
                  default: () => h(TableHead, null, { default: () => 'Name' }),
                }),
            },
          ),
      },
    ),
  );

  expect(root.querySelector('thead')?.className).toContain('sticky');
  app.unmount();
  root.remove();
});

test('selected rows expose state without owning selection', () => {
  const { app, root } = mountTree(
    h(Table, null, {
      default: () =>
        h(TableBody, null, {
          default: () =>
            h(
              TableRow,
              { selected: true },
              {
                default: () => h(TableCell, null, { default: () => 'Ada' }),
              },
            ),
        }),
    }),
  );

  const row = root.querySelector('tr[data-slot="table-row"]');
  expect(row?.getAttribute('data-state')).toBe('selected');
  app.unmount();
  root.remove();
});

test('sort buttons emit without owning sort state', async () => {
  let sorted = 0;
  const { app, root } = mountTree(
    h(Table, null, {
      default: () =>
        h(TableHeader, null, {
          default: () =>
            h(TableRow, null, {
              default: () =>
                h(
                  TableHead,
                  {
                    sortDirection: 'asc',
                    onSort: () => {
                      sorted += 1;
                    },
                  },
                  { default: () => 'Name' },
                ),
            }),
        }),
    }),
  );

  const button = root.querySelector<HTMLButtonElement>(
    '[data-slot="table-sort-button"]',
  );
  expect(button?.getAttribute('type')).toBe('button');
  expect(root.querySelector('th')?.getAttribute('aria-sort')).toBe('ascending');
  button?.click();
  expect(sorted).toBe(1);
  app.unmount();
  root.remove();
});

test('empty bodies render the empty slot', () => {
  const { app, root } = mountTree(
    h(Table, null, {
      default: () =>
        h(
          TableBody,
          { empty: true },
          {
            empty: () => 'Nothing here.',
          },
        ),
    }),
  );

  expect(
    root.querySelector('[data-slot="table-empty-row"]')?.textContent,
  ).toContain('Nothing here.');
  app.unmount();
  root.remove();
});

test('footer renders natively with totals', () => {
  const { app, root } = mountTree(
    h(Table, null, {
      default: () =>
        h(TableFooter, null, {
          default: () =>
            h(TableRow, null, {
              default: () => h(TableCell, null, { default: () => 'Total: 1' }),
            }),
        }),
    }),
  );

  expect(root.querySelector('table > tfoot > tr > td')?.textContent).toBe(
    'Total: 1',
  );
  app.unmount();
  root.remove();
});
