import { UploadCloudIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useUploads } from '../hooks/useUploads';

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

// Dropped folders show up as files too; keep only real files.
function droppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer.items ?? []);
  if (items.length === 0 || typeof items[0].webkitGetAsEntry !== 'function') {
    return { files: Array.from(dataTransfer.files ?? []), skippedFolders: 0 };
  }
  const files = [];
  let skippedFolders = 0;
  for (const item of items) {
    if (item.kind !== 'file') {
      continue;
    }
    if (item.webkitGetAsEntry()?.isDirectory) {
      skippedFolders += 1;
      continue;
    }
    const file = item.getAsFile();
    if (file) {
      files.push(file);
    }
  }
  return { files, skippedFolders };
}

// Wraps the file browser: files dragged from the computer onto it are uploaded to folderId (null = root).
export function UploadDropZone({ folderId = null, children }) {
  const { addFiles } = useUploads();
  const [dragging, setDragging] = useState(false);
  // dragenter / dragleave fire for every child element; count them to know when the drag really left.
  const depth = useRef(0);

  const handleDragEnter = (event) => {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  };

  const handleDragOver = (event) => {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event) => {
    if (!hasFiles(event)) {
      return;
    }
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) {
      setDragging(false);
    }
  };

  const handleDrop = (event) => {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    const { files, skippedFolders } = droppedFiles(event.dataTransfer);
    if (skippedFolders > 0) {
      toast.warning('Folders cannot be uploaded', {
        description: 'Create the folder here first, then drop its files into it.',
      });
    }
    addFiles(files, folderId);
  };

  return (
    <div
      className="relative flex flex-col gap-4"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-background/85 backdrop-blur-sm">
          <UploadCloudIcon className="size-8 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium">Drop files to upload them here</p>
        </div>
      )}
    </div>
  );
}
