import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  batchFiles,
  createFolder,
  deleteFromTrash,
  restoreFromTrash,
  updateFile,
  updateFolder,
} from '../api';
import { driveKeys } from '../queryKeys';

// Files and folders reference each other (listings, tree, paths, trash), so every
// change refreshes all of them. Changes that free or use space also refresh the totals.
function useInvalidateDrive() {
  const queryClient = useQueryClient();
  return ({ summary = false } = {}) => {
    const tasks = [queryClient.invalidateQueries({ queryKey: driveKeys.content() })];
    if (summary) {
      tasks.push(queryClient.invalidateQueries({ queryKey: driveKeys.summary() }));
      tasks.push(queryClient.invalidateQueries({ queryKey: driveKeys.accounts() }));
    }
    return Promise.all(tasks);
  };
}

const BATCH_LIMIT = 200;
const unique = (ids = []) => [...new Set(ids)];

// Sends files and folders through the batch endpoint, at most 200 of each per request.
async function runBatch(action, { fileIds = [], folderIds = [], folderId }) {
  const files = unique(fileIds);
  const folders = unique(folderIds);
  for (let i = 0; i < Math.max(files.length, folders.length); i += BATCH_LIMIT) {
    await batchFiles({
      action,
      ids: files.slice(i, i + BATCH_LIMIT),
      folderIds: folders.slice(i, i + BATCH_LIMIT),
      ...(action === 'move' ? { folderId: folderId ?? null } : {}),
    });
  }
}

const moveItems = (payload) => runBatch('move', payload);
const trashItems = (payload) => runBatch('trash', payload);

function renameItem({ type, id, name }) {
  return type === 'folder' ? updateFolder({ id, name }) : updateFile({ id, name });
}

// All file and folder changes of the file manager. Each entry is a mutation result:
// - rename.mutate({ type: 'file' | 'folder', id, name })
// - move.mutate({ fileIds, folderIds, folderId })   (folderId null = root)
// - trash.mutate({ fileIds, folderIds })
// - restore.mutate({ fileIds, folderIds })
// - deleteForever.mutate({ fileIds, folderIds } | { all: true })   (admin)
// - createFolder.mutate({ name, parentId })
// - updateFolder.mutate({ id, name?, parentId?, color? })
export function useDriveMutations() {
  const invalidate = useInvalidateDrive();
  const onChange = () => invalidate();
  const onSpaceChange = () => invalidate({ summary: true });

  const rename = useMutation({ mutationFn: renameItem, onSuccess: onChange });
  const move = useMutation({ mutationFn: moveItems, onSuccess: onChange });
  const trash = useMutation({ mutationFn: trashItems, onSettled: onSpaceChange });
  const restore = useMutation({ mutationFn: restoreFromTrash, onSuccess: onSpaceChange });
  const deleteForever = useMutation({ mutationFn: deleteFromTrash, onSettled: onSpaceChange });
  const createFolderMutation = useMutation({ mutationFn: createFolder, onSuccess: onChange });
  const updateFolderMutation = useMutation({ mutationFn: updateFolder, onSuccess: onChange });

  return {
    rename,
    move,
    trash,
    restore,
    deleteForever,
    createFolder: createFolderMutation,
    updateFolder: updateFolderMutation,
  };
}
