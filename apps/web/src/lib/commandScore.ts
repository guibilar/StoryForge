// Small substring + prefix-boost scorer for the command palette. Campaign
// entity/note/session lists are already unpaginated (fetched in full by the
// time this runs), so there's no need for a fuzzy-search dependency here —
// revisit only if that stops being true (a pagination problem, not a
// search-library one).
export function scoreMatch(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) {
    return 0;
  }

  const t = text.toLowerCase();
  if (t === q) {
    return 100;
  }
  if (t.startsWith(q)) {
    return 80;
  }

  const index = t.indexOf(q);
  if (index === -1) {
    return -1;
  }
  return 50 - Math.min(index, 49);
}
