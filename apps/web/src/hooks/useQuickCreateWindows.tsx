import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { useAddEditWindow } from "./useAddEditWindow";
import { EntityFormWindow } from "../components/EntityFormWindow";
import { NoteFormWindow } from "../components/NoteFormWindow";
import type { NoteRow } from "../components/NoteFormWindow";
import type { EntitySummary } from "../components/EntityWindow";

export interface QuickCreateOptions {
  // Lets a caller that lists entities itself (the start menu, the command
  // palette) refetch after a create; callers that don't, don't pass it.
  onEntityCreated?: () => void;
}

// "New Entity" / "New Note" are offered from three places — the start menu,
// the desktop's right-click menu, and the command palette — and all three
// used to carry their own copy of this window-opening code. The window ids
// (`entity-form`, `note-form`) are shared on purpose: asking for a new note
// twice reuses the one draft window rather than stacking two.
export function useQuickCreateWindows(
  campaignId: string,
  { onEntityCreated }: QuickCreateOptions = {},
) {
  const { layout, toggle } = useDesktopWindows();
  const { openAddEditWindow: openEntityFormWindow } = useAddEditWindow({
    idPrefix: "entity-form",
    width: 380,
    height: 460,
  });
  const { openAddEditWindow: openNoteFormWindow } = useAddEditWindow({
    idPrefix: "note-form",
    width: 420,
    height: 520,
  });

  function openCreateEntityWindow() {
    openEntityFormWindow<EntitySummary>(
      { mode: "create" },
      "New Entity",
      (close) => (
        <EntityFormWindow
          campaignId={campaignId}
          onCreated={onEntityCreated ?? (() => {})}
          onClose={close}
        />
      ),
    );
  }

  function openCreateNoteWindow() {
    openNoteFormWindow<NoteRow>({ mode: "create" }, "New Note", (close) => (
      <NoteFormWindow
        campaignId={campaignId}
        mode={{ mode: "create" }}
        // The Notes window unmounts entirely while closed (see
        // DesktopBoard.tsx), so opening it is enough to pick up the new note
        // on its own fresh fetch. If it's already open, leave it alone rather
        // than toggling it closed — its own refresh (KAN-110) covers that.
        onSaved={() => {
          if (layout.notes?.hidden) {
            toggle("notes");
          }
        }}
        onClose={close}
      />
    ));
  }

  return { openCreateEntityWindow, openCreateNoteWindow };
}
