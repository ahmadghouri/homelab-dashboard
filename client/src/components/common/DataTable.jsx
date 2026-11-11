import {
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SORT_ICONS = { asc: ArrowUpIcon, desc: ArrowDownIcon };

// TanStack Table v9: features are declared once, outside components.
const FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
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
      <span className="sr-only">{sorted ? `sorted ${sorted}ending` : 'sort'}</span>
    </button>
  );
}

// Sortable table on top of TanStack Table. Filtering and pagination are added when a page needs them.
// columns: TanStack column definitions. getRowId: stable id for each row.
export function DataTable({ columns, data, getRowId, initialSorting = [], emptyMessage = 'No data' }) {
  const table = useTable({
    features: FEATURES,
    data,
    columns,
    getRowId,
    initialState: { sorting: initialSorting },
  });

  const rows = table.getRowModel().rows;

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                aria-sort={
                  { asc: 'ascending', desc: 'descending' }[header.column.getIsSorted()] ?? undefined
                }
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
  );
}
