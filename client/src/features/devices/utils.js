// The disk closest to full is the one worth showing on summary cards.
export function fullestDisk(disks) {
  if (!disks?.length) {
    return null;
  }
  return disks.reduce((fullest, disk) => (disk.usedPct > fullest.usedPct ? disk : fullest));
}

export function isAdmin(user) {
  return user?.role === 'admin';
}
