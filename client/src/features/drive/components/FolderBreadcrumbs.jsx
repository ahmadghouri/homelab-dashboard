import { ChevronRightIcon, HardDriveIcon, SearchIcon } from 'lucide-react';
import { Fragment } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useFolderPath } from '../hooks/useFolders';

const crumbClassName =
  'max-w-40 truncate rounded-sm px-1 py-0.5 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:max-w-56';

// Breadcrumb from the Drive root to the open folder. With a search, shows the search instead.
export function FolderBreadcrumbs({ folderId, query, onNavigate }) {
  const { data: path, isPending, isError } = useFolderPath(query ? null : folderId);

  if (query) {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          Results for <span className="font-medium text-foreground">“{query}”</span> in all folders
        </span>
      </p>
    );
  }

  const crumbs = folderId && !isError ? (path ?? []) : [];

  return (
    <nav aria-label="Folder path" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm text-muted-foreground">
        <li>
          <button
            type="button"
            onClick={() => onNavigate(null)}
            aria-current={folderId ? undefined : 'page'}
            className={cn(crumbClassName, 'inline-flex items-center gap-1.5', !folderId && 'font-medium text-foreground')}
          >
            <HardDriveIcon className="size-4" aria-hidden="true" />
            Drive
          </button>
        </li>
        {folderId && isPending && (
          <li className="flex items-center gap-0.5">
            <ChevronRightIcon className="size-3.5" aria-hidden="true" />
            <Skeleton className="h-4 w-24" />
          </li>
        )}
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.id}>
              <li aria-hidden="true">
                <ChevronRightIcon className="size-3.5" />
              </li>
              <li className="min-w-0">
                <button
                  type="button"
                  onClick={() => onNavigate(crumb.id)}
                  aria-current={isLast ? 'page' : undefined}
                  title={crumb.name}
                  className={cn(crumbClassName, isLast && 'font-medium text-foreground')}
                >
                  {crumb.name}
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
