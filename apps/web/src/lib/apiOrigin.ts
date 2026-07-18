import { API_URL } from "./urqlClient";

// apps/api serves uploaded files (e.g. a campaign's map image) at
// server-relative paths like "/uploads/<id>/<uuid>.png" — resolved against
// window.location by a plain <img src>. In dev, apps/web and apps/api run on
// different ports (5173 vs 4000), so a raw relative path would resolve
// against the web app's own origin instead — Vite's SPA fallback then
// serves index.html for it with a 200, rendering as a broken image instead
// of erroring loudly. Prefixing with the API's own origin fixes this in
// both dev and single-origin production deployments alike.
export const API_ORIGIN = new URL(API_URL).origin;

export function resolveUploadUrl(url: string): string {
  return url.startsWith("/") ? `${API_ORIGIN}${url}` : url;
}
