/**
 * The folder tree of a job, worked out from a flat list of rows.
 *
 * A job has tens of folders, not thousands, so the whole list is read once and
 * walked here instead of with a recursive query — and being pure, the walk can
 * be checked without a database. Both walks stop on a loop rather than spinning:
 * no screen can make one, but a row edited by hand could.
 */

export type FolderRow = { id: string; parentId: string | null; name: string };

/** Root first, the folder itself last: the breadcrumb above the listing. */
export function folderTrail<T extends FolderRow>(folders: T[], folderId: string): T[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const trail: T[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}

/** The folder and everything under it — what deleting it takes along. */
export function subtreeIds(folders: FolderRow[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    children.set(folder.parentId, [...(children.get(folder.parentId) ?? []), folder.id]);
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return ids;
}

/**
 * Every folder as a path ("Plans / Rev C"), sorted — the options for moving a
 * file. A select can't show a tree, and the full path is what tells two
 * "Photos" folders apart.
 */
export function folderPaths(folders: FolderRow[]): { id: string; path: string }[] {
  return folders
    .map((folder) => ({ id: folder.id, path: folderTrail(folders, folder.id).map((f) => f.name).join(" / ") }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
