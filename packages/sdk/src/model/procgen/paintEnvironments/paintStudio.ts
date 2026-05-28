/**
 * Painter for an equirectangular studio-style environment image
 * suitable for image-based lighting.
 *
 * Unlike the {@link procgen/paintMaterials} painters (which return DOM-free
 * pixel buffers), this painter returns an `HTMLCanvasElement` because
 * the IBL environment sink (`IBL.setEnvironmentImage`) accepts canvas /
 * image / bitmap shapes, and the painting routine relies on canvas-2D
 * gradient and arc primitives.
 *
 * @module procgen/paintEnvironments/paintStudio
 */

/** Options accepted by {@link paintStudio}. */
export interface PaintStudioOptions {
  /**
   * Whether to paint the floor checkerboard in the lower half. Default
   * `true`.
   */
  floor?: boolean;
  /**
   * Whether to paint the sun disc + glow in the upper-left of the sky
   * band. Default `true`.
   */
  sun?: boolean;
  /**
   * Whether to paint the rectangular ceiling softboxes. Default `true`.
   */
  softboxes?: boolean;
  /**
   * Whether to paint the coloured wall panels around the horizon.
   * Default `true`.
   */
  panels?: boolean;
}

/**
 * Paints a studio-style equirectangular environment into a `width × height`
 * canvas, intended as input to `IBL.setEnvironmentImage`.

 */
export function paintStudio(
  width: number,
  height: number,
  options: PaintStudioOptions = {}
): HTMLCanvasElement {
  const drawFloor     = options.floor     ?? true;
  const drawSun       = options.sun       ?? true;
  const drawSoftboxes = options.softboxes ?? true;
  const drawPanels    = options.panels    ?? true;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0.00, "#3d68a8");
  grad.addColorStop(0.40, "#a8c0e0");
  grad.addColorStop(0.50, "#e8d4a8");
  grad.addColorStop(0.55, "#7d6850");
  grad.addColorStop(1.00, "#1f160e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  if (drawFloor) {
    const floorTopV = 0.55;
    const tile = Math.max(8, Math.round(width / 64));
    for (let y = Math.round(height * floorTopV); y < height; y += tile) {
      const vNorm = (y / height - floorTopV) / (1 - floorTopV);
      const fade  = 1.0 - vNorm * 0.8;
      for (let x = 0; x < width; x += tile) {
        const isLight = ((x / tile) + (y / tile)) % 2 === 0;
        const base = isLight ? 0.55 : 0.28;
        const v = Math.round(base * fade * 255);
        ctx.fillStyle = `rgb(${v},${Math.round(v * 0.9)},${Math.round(v * 0.78)})`;
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }

  if (drawSun) {
    const sx = width * 0.18, sy = height * 0.20;
    const sRadius = Math.min(width, height) * 0.04;
    ctx.fillStyle = "rgb(255,250,235)";
    ctx.beginPath(); ctx.arc(sx, sy, sRadius, 0, Math.PI * 2); ctx.fill();
  }

  if (drawSoftboxes) {
    const softboxes = [
      { u: 0.05, v: 0.18, w: 0.07, h: 0.025, tint: "rgb(255,255,250)" },
      { u: 0.21, v: 0.13, w: 0.09, h: 0.022, tint: "rgb(245,250,255)" },
      { u: 0.38, v: 0.16, w: 0.08, h: 0.030, tint: "rgb(255,250,240)" },
      { u: 0.54, v: 0.12, w: 0.10, h: 0.022, tint: "rgb(250,250,255)" },
      { u: 0.71, v: 0.16, w: 0.08, h: 0.028, tint: "rgb(255,248,235)" },
      { u: 0.87, v: 0.14, w: 0.09, h: 0.024, tint: "rgb(248,252,255)" }
    ];
    for (const sb of softboxes) {
      const x = sb.u * width, y = sb.v * height;
      const w = sb.w * width, h = sb.h * height;
      ctx.fillStyle = sb.tint;
      ctx.fillRect(x, y, w, h);
    }
  }

  if (drawPanels) {
    const panels = [
      { u: 0.04, v: 0.42, w: 0.10, h: 0.13, fill: "#cd5c5c", win: "#ffe8d8" },
      { u: 0.24, v: 0.42, w: 0.12, h: 0.13, fill: "#d2b245", win: "#fff5d8" },
      { u: 0.46, v: 0.42, w: 0.10, h: 0.13, fill: "#5cb05c", win: "#dff8df" },
      { u: 0.66, v: 0.42, w: 0.12, h: 0.13, fill: "#5c8ed6", win: "#dde8ff" },
      { u: 0.86, v: 0.42, w: 0.10, h: 0.13, fill: "#a25cb0", win: "#f0d8f8" }
    ];
    for (const p of panels) {
      const x = p.u * width, y = p.v * height;
      const w = p.w * width, h = p.h * height;
      ctx.fillStyle = p.fill;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = p.win;
      ctx.fillRect(x + w * 0.20, y + h * 0.20, w * 0.60, h * 0.50);
      ctx.fillStyle = p.fill;
      ctx.fillRect(x + w * 0.49, y + h * 0.20, w * 0.02, h * 0.50);
      ctx.fillRect(x + w * 0.20, y + h * 0.43, w * 0.60, h * 0.04);
    }
  }

  return canvas;
}
