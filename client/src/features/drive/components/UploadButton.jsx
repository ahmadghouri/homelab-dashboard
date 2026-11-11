import { UploadIcon } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useUploads } from '../hooks/useUploads';

// Opens the file picker (several files at once) and queues the chosen files for folderId (null = root).
export function UploadButton({ folderId = null }) {
  const inputRef = useRef(null);
  const { addFiles } = useUploads();

  const handleChange = (event) => {
    addFiles(event.target.files, folderId);
    // Reset so choosing the same file again still fires a change.
    event.target.value = '';
  };

  return (
    <>
      <input ref={inputRef} type="file" multiple hidden onChange={handleChange} tabIndex={-1} aria-hidden="true" />
      <Button onClick={() => inputRef.current?.click()}>
        <UploadIcon aria-hidden="true" />
        Upload
      </Button>
    </>
  );
}
