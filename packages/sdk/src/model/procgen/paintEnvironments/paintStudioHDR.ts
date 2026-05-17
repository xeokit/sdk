/**
 * HDR equirectangular studio-environment painter, mirroring the
 * scene of {@link paintStudio} (sun + softboxes + wall panels +
 * floor checkerboard) but at Float32 RGBA precision so the sun and
 * softbox cores survive the IBL prefilter as bright specular peaks
 * on smooth metals.
 *
 * @module procgen/paintEnvironments/paintStudioHDR
 */

import {paintStudio, type PaintStudioOptions} from "./paintStudio";

/** Options accepted by {@link paintStudioHDR}. */
export interface PaintStudioHDROptions extends PaintStudioOptions {
  /**
   * Sun core radiance multiplier. Default `20.0` — well above the
   * SDK's default `view.effects.bloom.threshold = 4.0` so the sun reliably
   * triggers a tight bloom glow, while the SDK's default
   * `view.effects.tonemap.exposure = 0.5` keeps the rest of the scene from
   * washing out around it.
   */
  sunIntensity?: number;
  /**
   * Softbox core radiance multiplier. Default `5.0` — visible
   * specular peaks on smooth metals; below the default bloom
   * threshold so softboxes don't compete with the sun for glow.
   */
  softboxIntensity?: number;
}

/**
 * Paints the studio scene at HDR (Float32 RGBA) precision. The
 * gradient sky, ceiling softboxes (cores), wall panels, and floor
 * checkerboard come from {@link paintStudio} with the LDR canvas
 * pixels read straight into the float buffer; the sun core and
 * softbox cores are then over-stamped at radiances above 1.0.
 *
 * Pair with {@link encodeRadianceHDR} and pass the result to
 * `IBL.setEnvironmentHDRBuffer` to drive the renderer's HDR IBL path.
 *
 * @returns Float32 RGBA pixel data, `width * height * 4` floats.
 */
export function paintStudioHDR(
  width: number,
  height: number,
  options: PaintStudioHDROptions = {}
): Float32Array<any> {
  const drawSun          = options.sun              ?? true;
  const drawSoftboxes    = options.softboxes        ?? true;
  const sunIntensity     = options.sunIntensity     ?? 20.0;
  const softboxIntensity = options.softboxIntensity ?? 5.0;

  // Render the LDR studio scene to a canvas, then upgrade each pixel
  // to Float32 RGBA in [0..1]. The sRGB canvas pixels are read as
  // linear here — a small colour shift in the gradient and panels,
  // but the IBL prefilter is dominated by the HDR-bright sun and
  // softbox cores stamped below, so the result reads as a studio
  // probe with strong specular peaks.
  const ldrCanvas = paintStudio(width, height, options);
  const ctx = ldrCanvas.getContext("2d")!;
  const ldr = ctx.getImageData(0, 0, width, height).data;

  const data = new Float32Array(width * height * 4);
  for (let i = 0, n = data.length; i < n; i += 4) {
    data[i]     = ldr[i]     / 255;
    data[i + 1] = ldr[i + 1] / 255;
    data[i + 2] = ldr[i + 2] / 255;
    data[i + 3] = 1;
  }

  // Stamp HDR sun core. Position and radius match paintStudio.
  if (drawSun) {
    const sx = width * 0.18;
    const sy = height * 0.20;
    const sRadius = Math.min(width, height) * 0.04;
    const r2 = sRadius * sRadius;
    const xMin = Math.max(0, Math.floor(sx - sRadius));
    const xMax = Math.min(width - 1, Math.ceil(sx + sRadius));
    const yMin = Math.max(0, Math.floor(sy - sRadius));
    const yMax = Math.min(height - 1, Math.ceil(sy + sRadius));
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        const dx = x - sx;
        const dy = y - sy;
        if (dx * dx + dy * dy > r2) continue;
        const i = (y * width + x) * 4;
        data[i]     = sunIntensity;
        data[i + 1] = sunIntensity * 0.96;
        data[i + 2] = sunIntensity * 0.85;
      }
    }
  }

  // Stamp HDR softbox cores. Layout matches paintStudio's softboxes
  // array exactly.
  if (drawSoftboxes) {
    const softboxes: { u: number; v: number; w: number; h: number; tint: [number, number, number] }[] = [
      { u: 0.05, v: 0.18, w: 0.07, h: 0.025, tint: [1.000, 1.000, 0.980] },
      { u: 0.21, v: 0.13, w: 0.09, h: 0.022, tint: [0.961, 0.980, 1.000] },
      { u: 0.38, v: 0.16, w: 0.08, h: 0.030, tint: [1.000, 0.980, 0.941] },
      { u: 0.54, v: 0.12, w: 0.10, h: 0.022, tint: [0.980, 0.980, 1.000] },
      { u: 0.71, v: 0.16, w: 0.08, h: 0.028, tint: [1.000, 0.973, 0.922] },
      { u: 0.87, v: 0.14, w: 0.09, h: 0.024, tint: [0.973, 0.988, 1.000] }
    ];
    for (const sb of softboxes) {
      const x0 = Math.max(0,      Math.floor(sb.u * width));
      const x1 = Math.min(width,  Math.ceil((sb.u + sb.w) * width));
      const y0 = Math.max(0,      Math.floor(sb.v * height));
      const y1 = Math.min(height, Math.ceil((sb.v + sb.h) * height));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          data[i]     = sb.tint[0] * softboxIntensity;
          data[i + 1] = sb.tint[1] * softboxIntensity;
          data[i + 2] = sb.tint[2] * softboxIntensity;
        }
      }
    }
  }

  return data;
}
