/**
 * HDR equirectangular studio-environment painter, suitable for the
 * renderer's HDR IBL path.
 *
 * @module generation/paintEnvironments/paintSunSkyHDR
 */

/** Options accepted by {@link paintSunSkyHDR}. */
export interface PaintSunSkyHDROptions {
  /**
   * World-space direction toward the sun. Normalised internally.
   * Default `[0.45, 0.35, 0.85]`.
   *
   * Coordinate basis: north = +X, east = +Y, up = +Z. The painted
   * equirect uses the same mapping the renderer's equirect-projection
   * shader samples, so a unit vector here maps to the lit pixel in
   * the output.
   */
  sunDirection?: [number, number, number];
  /**
   * Sun core radiance multiplier. Default `20.0` — well above the
   * SDK's default `view.effects.bloom.threshold = 4.0` so the sun reliably
   * triggers a tight bloom glow, while the SDK's default
   * `view.effects.tonemap.exposure = 0.5` keeps the rest of the scene from
   * washing out around it. Would clamp to 1.0 in an LDR pipeline.
   */
  sunIntensity?: number;
  /** Sun apparent angular radius in degrees. Default `3.0`. */
  sunRadiusDeg?: number;
  /**
   * Sky zenith colour, **linear** radiance. Default `[0.085, 0.198,
   * 0.694]` — a sRGB `[0.32, 0.48, 0.85]` blue, decoded.
   */
  skyColor?: [number, number, number];
  /**
   * Horizon haze colour, **linear** radiance. Default `[0.694, 0.578,
   * 0.343]` — a sRGB `[0.85, 0.78, 0.62]` warm tan, decoded.
   */
  horizonColor?: [number, number, number];
  /**
   * Ground / nadir colour, **linear** radiance. Default `[0.051, 0.051,
   * 0.100]` — a sRGB `[0.25, 0.25, 0.35]` dark slate, decoded.
   */
  groundColor?: [number, number, number];
  /**
   * Width of the smooth blend across the horizon, expressed as
   * `sin(latitude)`. Default `0.25`.
   */
  horizonBlend?: number;
}

/**
 * Paints an HDR studio-style equirectangular environment into a
 * `width × height` Float32 RGBA buffer (row-major, top-down,
 * `alpha = 1`).
 *
 * Layout:
 *
 *   - Three-band gradient: zenith sky → horizon haze → ground, with a
 *     `horizonBlend`-wide smoothstep on either side of the horizon.
 *   - A bright sun disc (radiance `sunIntensity`) at the world-space
 *     direction `sunDirection`, wrapped in a soft `sd^32` glow that
 *     bleeds into the surrounding sky.
 *
 * Pair with {@link encodeRadianceHDR} and pass the result to
 * `IBL.setEnvironmentHDRBuffer` to drive the renderer's HDR IBL path.
 *
 * @returns Float32 RGBA pixel data, `width * height * 4` floats.
 */
export function paintSunSkyHDR(
  width: number,
  height: number,
  options: PaintSunSkyHDROptions = {}
): Float32Array<any> {
  const sunDirInput  = options.sunDirection ?? [0.45, 0.35, 0.85];
  const sunIntensity = options.sunIntensity ?? 20.0;
  const sunRadiusDeg = options.sunRadiusDeg ?? 3.0;
  const skyCol       = options.skyColor     ?? [0.085, 0.198, 0.694];
  const horizonCol   = options.horizonColor ?? [0.694, 0.578, 0.343];
  const groundCol    = options.groundColor  ?? [0.051, 0.051, 0.100];
  const horizonBlend = options.horizonBlend ?? 0.25;

  const sunLen = Math.hypot(sunDirInput[0], sunDirInput[1], sunDirInput[2]) || 1;
  const sunDir: [number, number, number] = [
    sunDirInput[0] / sunLen,
    sunDirInput[1] / sunLen,
    sunDirInput[2] / sunLen
  ];
  const sunCos = Math.cos((sunRadiusDeg * Math.PI) / 180);

  const data = new Float32Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;       // 0 = top of image
    const lat = (0.5 - v) * Math.PI;    //  π/2 = up,  -π/2 = down
    const cLat = Math.cos(lat);
    const sLat = Math.sin(lat);
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const lon = (u - 0.5) * 2 * Math.PI;
      const dx = Math.cos(lon) * cLat;
      const dy = Math.sin(lon) * cLat;
      const dz = sLat;

      const t = sLat;  // dot(dir, world-up [0,0,1])
      let r: number, g: number, b: number;
      if (t > 0) {
        const k = Math.min(1, t / horizonBlend);
        const e = k * k * (3 - 2 * k);
        r = horizonCol[0] + (skyCol[0] - horizonCol[0]) * e;
        g = horizonCol[1] + (skyCol[1] - horizonCol[1]) * e;
        b = horizonCol[2] + (skyCol[2] - horizonCol[2]) * e;
      } else {
        const k = Math.min(1, -t / horizonBlend);
        const e = k * k * (3 - 2 * k);
        r = horizonCol[0] + (groundCol[0] - horizonCol[0]) * e;
        g = horizonCol[1] + (groundCol[1] - horizonCol[1]) * e;
        b = horizonCol[2] + (groundCol[2] - horizonCol[2]) * e;
      }

      const sd = dx * sunDir[0] + dy * sunDir[1] + dz * sunDir[2];
      if (sd > sunCos) {
        // Sun disc — sharp HDR core.
        r = sunIntensity;
        g = sunIntensity * 0.96;
        b = sunIntensity * 0.82;
      } else if (sd > 0) {
        // Soft glow bleeding into the sky / horizon, peaking at the
        // sun and falling off with sd^32.
        const glow = Math.pow(sd, 32) * 1.4;
        r += glow;
        g += glow * 0.95;
        b += glow * 0.78;
      }

      const i = (y * width + x) * 4;
      data[i]     = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }
  return data;
}
