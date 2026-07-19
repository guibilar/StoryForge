import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { NoteViewWindow } from "../components/NoteViewWindow";

const DEFAULT_NOTE_WINDOW = { width: 460, height: 520 };

// Shared by every place that opens a note for reading — the Notes window,
// an entity's Notes tab, a `[[wiki link]]`, a backlink. Mirrors
// useOpenEntityWindow; the note:{id} id means following the same link twice
// focuses the window that's already open instead of stacking duplicates.
export function useOpenNoteWindow(campaignId: string) {
  const { openWindow, dynamicWindows } = useDesktopWindows();

  return function openNoteWindow(noteId: string, title: string) {
    const offset = (Object.keys(dynamicWindows).length % 6) * 24;

    openWindow({
      id: `note:${noteId}`,
      title,
      render: () => <NoteViewWindow noteId={noteId} campaignId={campaignId} />,
      x: 180 + offset,
      y: 88 + offset,
      width: DEFAULT_NOTE_WINDOW.width,
      height: DEFAULT_NOTE_WINDOW.height,
    });
  };
}
