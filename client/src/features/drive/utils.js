import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  Presentation,
} from 'lucide-react';
import { contentPath } from './api';

export const FILE_KINDS = [
  { value: 'image', label: 'Image', icon: FileImage },
  { value: 'video', label: 'Video', icon: FileVideo },
  { value: 'audio', label: 'Audio', icon: FileAudio },
  { value: 'pdf', label: 'PDF', icon: FileType },
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'spreadsheet', label: 'Spreadsheet', icon: FileSpreadsheet },
  { value: 'presentation', label: 'Presentation', icon: Presentation },
  { value: 'archive', label: 'Archive', icon: FileArchive },
  { value: 'text', label: 'Text', icon: FileText },
  { value: 'other', label: 'Other', icon: File },
];

const KIND_BY_VALUE = new Map(FILE_KINDS.map((kind) => [kind.value, kind]));

// Lucide icon component for a file kind.
export function fileKindIcon(kind) {
  return KIND_BY_VALUE.get(kind)?.icon ?? File;
}

export function fileKindLabel(kind) {
  return KIND_BY_VALUE.get(kind)?.label ?? 'File';
}

// URL that streams the file (inline by default, as an attachment with download).
export function contentUrl(fileId, { download = false } = {}) {
  return contentPath(fileId, { download });
}

const PREVIEW_KINDS = new Set(['image', 'video', 'audio', 'pdf', 'text']);

// True when FilePreviewDialog can render the file in the browser.
export function isPreviewable(file) {
  return Boolean(file) && PREVIEW_KINDS.has(file.kind);
}

// Access object with everything off; used while loading and for users without a DriveAccess document.
export const NO_DRIVE_ACCESS = {
  canView: false,
  canDownload: false,
  canUpload: false,
  canDelete: false,
  canShare: false,
  scope: 'folders',
  folderIds: [],
};

// Gives folders and files one shape for the grid, the table and the selection.
export function toDriveItems({ folders = [], files = [] }) {
  return [
    ...folders.map((folder) => ({ ...folder, type: 'folder', key: `folder:${folder.id}` })),
    ...files.map((file) => ({ ...file, type: 'file', key: `file:${file.id}` })),
  ];
}

// Splits selected items into the id lists the API expects.
export function splitIds(items) {
  return {
    fileIds: items.filter((item) => item.type === 'file').map((item) => item.id),
    folderIds: items.filter((item) => item.type === 'folder').map((item) => item.id),
  };
}
