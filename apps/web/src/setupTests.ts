import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Node 22+ ships an experimental global `localStorage` gated behind
// --localstorage-file. It shadows jsdom's window.localStorage with a
// getter that silently returns undefined, breaking every test that
// touches storage. Replace it with a plain in-memory Storage.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

// Without this, a write in one test (e.g. reporting a map viewport) leaks
// into every later test in the same file via the shared MemoryStorage above.
afterEach(() => {
  localStorage.clear();
});

// jsdom implements no ResizeObserver. MapCanvas uses one to keep Leaflet's
// cached container size in step with desktop-window resizing, so without a
// stub every test that renders a map throws on construction. Tests that need
// to drive a resize stub their own via vi.stubGlobal.
if (!("ResizeObserver" in globalThis)) {
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    configurable: true,
    writable: true,
  });
}
