import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { EntityWindow } from "../components/EntityWindow";
import type { EntitySummary } from "../components/EntityWindow";

const DEFAULT_ENTITY_WINDOW = { width: 380, height: 420 };

// Shared by every place that opens an entity:{id} window (EntitySidebar,
// EntityWindow's own Relationships tab, RelationshipGraphWindow's node
// click) — extracted once a 3rd caller needed the same cascade-offset +
// render-function logic, per the "don't extract until it's needed twice
// more" convention used elsewhere in this epic.
export function useOpenEntityWindow(campaignId: string) {
  const { openWindow, dynamicWindows } = useDesktopWindows();

  return function openEntityWindow(entity: EntitySummary) {
    // A cascade offset so opening several entity windows in a row doesn't
    // stack them exactly on top of each other. openWindow itself restores
    // the saved position instead of this default if the window was already
    // opened (and possibly moved) before, so this only matters the first time.
    const offset = (Object.keys(dynamicWindows).length % 6) * 24;
    openWindow({
      id: `entity:${entity.id}`,
      title: entity.name,
      render: () => <EntityWindow entity={entity} campaignId={campaignId} />,
      x: 140 + offset,
      y: 80 + offset,
      width: DEFAULT_ENTITY_WINDOW.width,
      height: DEFAULT_ENTITY_WINDOW.height,
    });
  };
}
