function key(campaignId: string): string {
  return `storyforge:desktop:${campaignId}:updatedAt`;
}

/**
 * Records that local workspace state (layout or recents) was just written.
 * Read back by useWorkspaceStateSync to decide whether a server snapshot is
 * actually newer than what this browser already has — without it, every
 * load overwrites local state with the server's copy, which silently
 * discards any change whose debounced save didn't make it up before the tab
 * was closed.
 */
export function markLocalWorkspaceWrite(campaignId: string): void {
  try {
    localStorage.setItem(key(campaignId), String(Date.now()));
  } catch {
    // Storage full or blocked — the sync just falls back to trusting the
    // server, which is the old behaviour.
  }
}

export function readLocalWorkspaceWrite(campaignId: string): number | null {
  try {
    const raw = localStorage.getItem(key(campaignId));
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
