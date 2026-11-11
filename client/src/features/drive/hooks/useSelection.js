import { useState } from 'react';

// Checkbox selection over a list of items with a stable `key`.
// toggle(item, { range: true }) selects everything between the last toggled item and this one.
// Keys of items that are no longer in the list are ignored (they disappear after a refetch).
export function useSelection(items) {
  const [keys, setKeys] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);

  const selectedItems = items.filter((item) => keys.has(item.key));
  const selectedKeys = new Set(selectedItems.map((item) => item.key));

  const toggle = (item, { range = false } = {}) => {
    const anchorIndex = range && anchor ? items.findIndex((entry) => entry.key === anchor) : -1;
    const index = items.findIndex((entry) => entry.key === item.key);
    setKeys((previous) => {
      const next = new Set([...previous].filter((key) => items.some((entry) => entry.key === key)));
      if (anchorIndex >= 0 && index >= 0) {
        const [from, to] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
        for (const entry of items.slice(from, to + 1)) {
          next.add(entry.key);
        }
      } else if (next.has(item.key)) {
        next.delete(item.key);
      } else {
        next.add(item.key);
      }
      return next;
    });
    setAnchor(item.key);
  };

  const setAll = (selected) => {
    setKeys(selected ? new Set(items.map((item) => item.key)) : new Set());
    setAnchor(null);
  };

  return { selectedKeys, selectedItems, toggle, setAll, clear: () => setAll(false) };
}
