/**
 * Painter for an equirectangular sky-with-key-lights environment image
 * suitable for image-based lighting. Simpler than
 * {@link paintStudio}: a three-band sky/horizon/ground gradient
 * plus three soft radial key lights above the horizon.
 *
 * Returns an `HTMLCanvasElement` for the same reasons as
 * {@link paintStudio}.
 *
 * @module procgen/paintEnvironments/paintSky
 */

/** Options accepted by {@link paintSky}. */
export interface PaintSkyOptions {
  /**
   * Whether to paint the three soft key lights above the horizon.
   * Default `true`.
   */
  keyLights?: boolean;
}

/**
 * Paints a sky-with-key-lights equirectangular environment into a
 * `width × height` canvas, intended as input to
 * `IBL.setEnvironmentImage`.
 *
 * Layout (top → bottom in equirect v):
 *
 *   - **sky band**     : cool blue zenith fading to a warm horizon.
 *   - **horizon band** : warm tan / peach — the dominant reflection
 *     colour for smooth metals and glass.
 *   - **ground band**  : muted brown fading to a darker nadir.
 *
 * Three soft key lights at longitudes 0°, 120°, 240° sit ~30° above
 * the horizon (warm, cool, amber tints), giving smooth-metal
 * reflections recognisable bright spots without the architectural
 * detail of {@link paintStudio}.
 */
export function paintSky(
  width: number,
  height: number,
  options: PaintSkyOptions = {}
): HTMLCanvasElement {
  const drawKeyLights = options.keyLights ?? true;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0.00, "#7090c0");
  grad.addColorStop(0.42, "#cfdcec");
  grad.addColorStop(0.50, "#e8d4a8");
  grad.addColorStop(0.55, "#a08868");
  grad.addColorStop(1.00, "#5a4a3a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  if (drawKeyLights) {
    const keyLightY = Math.round(height * 0.30);
    const keyLightR = Math.round(Math.min(width, height) * 0.07);
    const xs = [
      Math.round(width * 0.18),
      Math.round(width * 0.52),
      Math.round(width * 0.83)
    ];
    const tints: [number, number, number][] = [
      [255, 245, 210],
      [220, 230, 255],
      [255, 220, 180]
    ];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const [r, g, b] = tints[i];
      const lightGrad = ctx.createRadialGradient(x, keyLightY, 0, x, keyLightY, keyLightR);
      lightGrad.addColorStop(0,   `rgba(${r},${g},${b},1.00)`);
      lightGrad.addColorStop(0.4, `rgba(${r},${g},${b},0.55)`);
      lightGrad.addColorStop(1,   `rgba(${r},${g},${b},0.00)`);
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.arc(x, keyLightY, keyLightR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas;
}
