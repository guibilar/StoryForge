import { useCallback, useState } from "react";

import type { MapViewport } from "../components/MapCanvas";

function storageKey(campaignId: string): string {
  return `storyforge:mapViewport:${campaignId}`;
}

function loadViewport(campaignId: string): MapViewport | null {
  try {
    const raw = localStorage.getItem(storageKey(campaignId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<MapViewport> | null;
    if (
      !parsed ||
      typeof parsed.zoom !== "number" ||
      typeof parsed.center?.lat !== "number" ||
      typeof parsed.center?.lng !== "number"
    ) {
      return null;
    }
    return {
      center: { lat: parsed.center.lat, lng: parsed.center.lng },
      zoom: parsed.zoom,
    };
  } catch {
    return null;
  }
}

// localStorage-backed last-viewed center/zoom for a campaign's map, mirroring
// useRecentEntities/useDesktopLayout's per-campaign localStorage precedent.
// Device-local only (like useRecentEntities before KAN-104's server sync) —
// where you left the camera isn't meaningful to sync across devices.
export function useMapViewport(campaignId: string) {
  const [savedViewport] = useState<MapViewport | null>(() =>
    loadViewport(campaignId),
  );

  const recordViewport = useCallback(
    (viewport: MapViewport) => {
      localStorage.setItem(storageKey(campaignId), JSON.stringify(viewport));
    },
    [campaignId],
  );

  return { savedViewport, recordViewport };
}
