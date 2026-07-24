import { useEffect, useRef } from "react";

import { useColorScheme } from "../hooks/useColorScheme";
import styles from "./DesktopWallpaper.module.css";

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const DENSITY_DIVISOR = 26_000;
const MIN_STARS = 24;
const MAX_STARS = 64;
const DRIFT = 0.09;
// Repainting at the display's native rate (often 60Hz+) forces every
// backdrop-filter: blur() surface above this canvas (taskbar, modals, the
// command palette) to resample it that often too — a heavy compositor path
// that showed up as visible chrome flicker. The drift is meant to read as
// "slow" anyway, so capping the redraw rate costs nothing visually.
const FRAME_INTERVAL_MS = 1000 / 20;

// The desk's backdrop: a slow constellation of linked points — the campaign's
// own relationship graph, abstracted. Canvas rather than SVG or a stack of
// gradients because the link lines are recomputed every frame from point
// distance, which is a per-pixel job, not a DOM one.
export function DesktopWallpaper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Redrawing on a theme switch needs the resolved theme, not the media
  // query: the tray's theme control sets [data-theme], which
  // prefers-color-scheme knows nothing about.
  const scheme = useColorScheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Read straight off the element so the palette always matches whatever
    // tokens.css resolved for the current theme, rather than duplicating
    // hex values here.
    const computed = getComputedStyle(document.documentElement);
    const accent = computed.getPropertyValue("--accent").trim() || "#8b3bff";
    const surface = computed.getPropertyValue("--surface").trim() || "#ffffff";
    const background = computed.getPropertyValue("--bg").trim() || "#faf9fb";

    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTick = 0;

    function size() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = Math.max(
        MIN_STARS,
        Math.min(MAX_STARS, Math.round((width * height) / DENSITY_DIVISOR)),
      );
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * DRIFT,
        vy: (Math.random() - 0.5) * DRIFT,
        r: 0.8 + Math.random() * 1.8,
      }));
    }

    function draw() {
      const gradient = context!.createLinearGradient(0, 0, width * 0.6, height);
      gradient.addColorStop(0, background);
      gradient.addColorStop(0.55, surface);
      gradient.addColorStop(1, background);
      context!.fillStyle = gradient;
      context!.fillRect(0, 0, width, height);

      const linkDistance = Math.min(160, Math.max(90, width / 9));
      context!.strokeStyle = accent;
      for (let i = 0; i < stars.length; i += 1) {
        for (let j = i + 1; j < stars.length; j += 1) {
          const a = stars[i];
          const b = stars[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance >= linkDistance) {
            continue;
          }
          context!.globalAlpha = 0.18 * (1 - distance / linkDistance);
          context!.beginPath();
          context!.moveTo(a.x, a.y);
          context!.lineTo(b.x, b.y);
          context!.stroke();
        }
      }

      context!.fillStyle = accent;
      context!.globalAlpha = 0.4;
      for (const star of stars) {
        context!.beginPath();
        context!.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context!.fill();
      }
      context!.globalAlpha = 1;
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      if (now - lastTick < FRAME_INTERVAL_MS) {
        return;
      }
      lastTick = now;

      for (const star of stars) {
        star.x += star.vx;
        star.y += star.vy;
        if (star.x < -20) star.x = width + 20;
        if (star.x > width + 20) star.x = -20;
        if (star.y < -20) star.y = height + 20;
        if (star.y > height + 20) star.y = -20;
      }
      draw();
    }

    function handleResize() {
      size();
      draw();
    }

    size();
    draw();
    window.addEventListener("resize", handleResize);
    if (!reduced) {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frame);
    };
  }, [scheme]);

  return <canvas ref={canvasRef} className={styles.wallpaper} aria-hidden />;
}
