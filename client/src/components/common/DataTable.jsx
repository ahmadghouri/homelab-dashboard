import {
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SORT_ICONS = { asc: ArrowUpIcon, desc: ArrowDownIcon };
const ARIA_SORT = { asc: 'ascending', desc: 'descending' };

// TanStack Table v9: features are declared once, outside components.
const SORTING = { rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns };
const FEATURES = tableFeatures(SORTING);
const FEATURES_WITH_PAGES = tableFeatures({
  ...SORTING,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

function SortableHeader({ header }) {
  const content = flexRender(header.column.columnDef.header, header.getContext());
  if (!header.column.getCanSort()) {
    return content;
  }
  const sorted = header.column.getIsSorted();
  const Icon = SORT_ICONS[sorted] ?? ArrowUpDownIcon;
  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted"
    >
      {content}
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function Pagination({ table }) {
  const pageCount = table.getPageCount();
  if (pageCount <= 1) {
    return null;
  }
  const { pageIndex } = table.state.pagination;
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-sm text-muted-foreground">
      <span>
        {table.getRowCount()} rows · page {pageIndex + 1} of {pageCount}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

// Sortable table on top of TanStack Table. Filter the `data` in the parent when needed.
// columns: TanStack column definitions (meta.className styles a column's cells).
// pageSize: turns on pagination when set.
export function DataTable({
  columns,
  data,
  getRowId,
  initialSorting = [],
  pageSize,
  emptyMessage = 'No data',
}) {
  const table = useTable({
    features: pageSize ? FEATURES_WITH_PAGES : FEATURES,
    data,
    columns,
    getRowId,
    // Live data refreshes often; keep the user's page and sorting when it does.
    autoResetAll: false,
    initialState: {
      sorting: initialSorting,
      ...(pageSize ? { pagination: { pageIndex: 0, pageSize } } : {}),
    },
  });

  const rows = table.getRowModel().rows;

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={ARIA_SORT[header.column.getIsSorted()]}
                  className={header.column.columnDef.meta?.className}
                >
                  {header.isPlaceholder ? null : <SortableHeader header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-20 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {pageSize && <Pagination table={table} />}
    </div>
  );
}
