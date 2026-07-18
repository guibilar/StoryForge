import { MapCanvas } from "./MapCanvas";

// Thin catalog wrapper around MapCanvas — kept separate so KAN-51/52 can
// add campaign-scoped data fetching here without touching MapCanvas itself,
// the same split RelationshipGraphWindow doesn't need (yet) since it has no
// sibling reuse of its ReactFlow rendering elsewhere.
export function MapsWindow() {
  return <MapCanvas />;
}
