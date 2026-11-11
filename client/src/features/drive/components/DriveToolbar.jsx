import { FolderPlusIcon, LayoutGridIcon, ListIcon, SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { FILE_KINDS } from '../utils';
import { UploadButton } from './UploadButton';

const SEARCH_DELAY_MS = 300;
const ALL_KINDS = 'all';

// Search box that writes to the URL after a short pause. URL changes from outside
// (back button, clearing) are copied back into the box.
function SearchBox({ query, onQueryChange }) {
  const [text, setText] = useState(query);
  const [lastQuery, setLastQuery] = useState(query);

  if (query !== lastQuery) {
    setLastQuery(query);
    if (query !== text.trim()) {
      setText(query);
    }
  }

  useEffect(() => {
    const next = text.trim();
    if (next === query) {
      return undefined;
    }
    const timer = setTimeout(() => onQueryChange(next), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, query, onQueryChange]);

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onQueryChange(text.trim());
          }
        }}
        placeholder="Search all files"
        aria-label="Search files by name"
        maxLength={200}
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('');
            onQueryChange('');
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function ViewToggle({ view, onViewChange }) {
  const options = [
    { value: 'grid', label: 'Grid view', icon: LayoutGridIcon },
    { value: 'list', label: 'List view', icon: ListIcon },
  ];
  return (
    <div role="group" aria-label="Layout" className="flex rounded-lg border p-0.5">
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={view === value}
          onClick={() => onViewChange(value)}
          className={cn(view === value && 'bg-muted text-foreground')}
        >
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}

// Search, kind filter, layout toggle, New folder and Upload (when the access allows).
export function DriveToolbar({
  query,
  onQueryChange,
  kind,
  onKindChange,
  view,
  onViewChange,
  folderId,
  canUpload,
  onNewFolder,
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchBox query={query} onQueryChange={onQueryChange} />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind || ALL_KINDS} onValueChange={(value) => onKindChange(value === ALL_KINDS ? '' : value)}>
          <SelectTrigger className="w-36" aria-label="Filter by kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_KINDS}>All kinds</SelectItem>
            {FILE_KINDS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ViewToggle view={view} onViewChange={onViewChange} />
        {canUpload && (
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={onNewFolder}>
              <FolderPlusIcon aria-hidden="true" />
              New folder
            </Button>
            <UploadButton folderId={folderId ?? null} />
          </div>
        )}
      </div>
    </div>
  );
}
