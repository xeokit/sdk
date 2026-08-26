/**
 * Painter for an equirectangular sunset environment image suitable
 * for image-based lighting. Produces a single bright sun on the
 * horizon against a deep zenith, with optional warm cloud streaks.
 *
 * Returns an `HTMLCanvasElement` for the same reasons as
 * {@link generation/paintEnvironments/paintStudio}.
 *
 * @module generation/paintEnvironments/paintSunset
 */

/** Options accepted by {@link paintSunset}. */
export interface PaintSunsetOptions {
  /**
   * Whether to paint the sun disc + halo on the horizon. Default
   * `true`.
   */
  sun?: boolean;
  /**
   * Whether to paint warm horizontal cloud streaks above the horizon.
   * Default `true`.
   */
  clouds?: boolean;
}

/**
 * Paints a sunset-style equirectangular environment into a `width × height`
 * canvas, intended as input to `IBL.setEnvironmentImage`.
 */
export function paintSunset(
  width: number,
  height: number,
  options: PaintSunsetOptions = {}
): HTMLCanvasElement {
  const drawSun    = options.sun    ?? true;
  const drawClouds = options.clouds ?? true;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0.00, "#0c1430");
  grad.addColorStop(0.20, "#1c2a55");
  grad.addColorStop(0.35, "#54416f");
  grad.addColorStop(0.45, "#c46a4a");
  grad.addColorStop(0.50, "#ffb070");
  grad.addColorStop(0.52, "#cd7038");
  grad.addColorStop(0.65, "#3a1a10");
  grad.addColorStop(1.00, "#0a0604");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  if (drawClouds) {
    const clouds = [
      { v: 0.32, alpha: 0.30, tint: "255,200,160", h: 0.020 },
      { v: 0.38, alpha: 0.40, tint: "255,170,120", h: 0.025 },
      { v: 0.43, alpha: 0.55, tint: "255,140, 90", h: 0.020 }
    ];
    for (const c of clouds) {
      const cy = c.v * height;
      const ch = c.h * height;
      const cgrad = ctx.createLinearGradient(0, cy - ch, 0, cy + ch);
      cgrad.addColorStop(0.0, `rgba(${c.tint},0)`);
      cgrad.addColorStop(0.5, `rgba(${c.tint},${c.alpha})`);
      cgrad.addColorStop(1.0, `rgba(${c.tint},0)`);
      ctx.fillStyle = cgrad;
      ctx.fillRect(0, cy - ch, width, 2 * ch);
    }
  }

  if (drawSun) {
    const sx = width * 0.5;
    const sy = height * 0.49;
    const sRadius = Math.min(width, height) * 0.035;
    const glowRadius = sRadius * 8.0;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius);
    glow.addColorStop(0.00, "rgba(255,235,180,0.85)");
    glow.addColorStop(0.15, "rgba(255,200,130,0.55)");
    glow.addColorStop(0.40, "rgba(255,150, 80,0.20)");
    glow.addColorStop(1.00, "rgba(255,150, 80,0.00)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "rgb(255,250,230)";
    ctx.beginPath(); ctx.arc(sx, sy, sRadius, 0, Math.PI * 2); ctx.fill();
  }

  return canvas;
}
