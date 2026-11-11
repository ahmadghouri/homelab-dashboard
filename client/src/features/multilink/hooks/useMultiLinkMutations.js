import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { resetLineUsage, runLineSpeedTest, saveMultiLinkSettings } from '../api';
import { multiLinkKeys } from '../queryKeys';

const MAX_SAVED_LINES = 16;

// The settings to send with a change, from the useMultiLink data. The PUT replaces every setting,
// so the mode, sticky and the other lines' roles and caps are kept. Falls back to the agent's
// snapshot when nothing was saved yet.
export function buildSettings(data, { mode, sticky, lineId, line } = {}) {
  const saved = data?.settings ?? {};
  const snapshot = data?.multilink;
  let lines = { ...saved.lines };

  if (lineId) {
    lines[lineId] = line;
  }
  // The server accepts at most 16 lines: drop saved lines the PC no longer reports first.
  const ids = Object.keys(lines);
  if (ids.length > MAX_SAVED_LINES && snapshot) {
    const current = new Set(snapshot.lines.map((item) => item.id));
    lines = Object.fromEntries(Object.entries(lines).filter(([id]) => current.has(id) || id === lineId));
  }

  return {
    mode: mode ?? saved.mode ?? snapshot?.mode ?? 'balanced',
    sticky: sticky ?? saved.sticky ?? snapshot?.sticky ?? true,
    lines,
  };
}

// Toast for a successful save: tells whether the PC already applied the settings.
export function showSaveResult(pushed, title = 'Settings saved') {
  if (!pushed) {
    toast.success(title, { description: 'The PC is offline. It gets the settings when its agent reconnects.' });
  } else if (pushed.ok) {
    toast.success(title, { description: 'The PC applied them.' });
  } else {
    toast.warning(title, {
      description: `Saved, but the PC did not apply them: ${pushed.output || 'no answer'}. It retries when the agent reconnects.`,
    });
  }
}

// Variables: { deviceId, settings: { mode, sticky, lines } }. Resolves with { settings, pushed }.
export function useSaveMultiLinkSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveMultiLinkSettings,
    onSuccess: ({ settings }, { deviceId }) => {
      // The response holds the saved settings: show them at once, the agent's next snapshot follows.
      queryClient.setQueryData(multiLinkKeys.detail(deviceId), (previous) =>
        previous ? { ...previous, settings } : previous,
      );
    },
    onSettled: (_, __, { deviceId }) =>
      queryClient.invalidateQueries({ queryKey: multiLinkKeys.detail(deviceId) }),
  });
}

// Variables: { deviceId, lineId }. Resolves with { ok, output, downloadMbps }.
export function useLineSpeedTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runLineSpeedTest,
    onSettled: (_, __, { deviceId }) =>
      queryClient.invalidateQueries({ queryKey: multiLinkKeys.detail(deviceId) }),
  });
}

// Variables: { deviceId, lineId }. Resolves with { ok, output }.
export function useResetLineUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetLineUsage,
    onSettled: (_, __, { deviceId }) =>
      queryClient.invalidateQueries({ queryKey: multiLinkKeys.detail(deviceId) }),
  });
}
