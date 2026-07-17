import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export interface OpenWindowRequest {
  id: string;
  title: string;
  render: () => ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopWindowsApi {
  openWindow: (request: OpenWindowRequest) => void;
  closeWindow: (id: string) => void;
}

export const DesktopWindowsContext = createContext<DesktopWindowsApi | null>(
  null,
);

// Lets a descendant of <DesktopBoard> (e.g. RelationshipGraphWindow) open a
// window for an id chosen at runtime, not just the static windowCatalog
// entries. Components rendered as *siblings* of DesktopBoard (a future
// entity sidebar, KAN-96) can't reach this context as-is — that needs the
// provider lifted to wherever both are mounted, which is that ticket's job.
export function useDesktopWindows(): DesktopWindowsApi {
  const ctx = useContext(DesktopWindowsContext);
  if (!ctx) {
    throw new Error("useDesktopWindows must be used within a <DesktopBoard>");
  }
  return ctx;
}
