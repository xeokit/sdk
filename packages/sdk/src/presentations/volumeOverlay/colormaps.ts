/**
 * Colormap library for volume overlays + heatmaps. Each entry is a
 * stop-array of RGB triples evenly distributed across the value
 * range `[0, 1]`; callers interpolate between adjacent stops.
 *
 * Names + palettes follow the matplotlib / D3 conventions so users
 * coming from those ecosystems read the same image. The included
 * set covers the four shading conventions that account for ~90% of
 * scientific-viz output:
 *
 *   - **Perceptual** (`viridis`, `plasma`) — uniform luminance ramp;
 *     scientifically defensible for unbiased magnitude reading.
 *   - **Diverging** (`coolwarm`) — symmetric around a midpoint;
 *     ideal for fields with a "neutral" centre (temperature
 *     anomaly, pressure differential).
 *   - **Sequential warm** (`thermal`) — black-body-radiation
 *     analogue; reads as "hotter = brighter" intuitively.
 *   - **Rainbow** (`jet`) — discouraged for precision but still
 *     widely used in legacy CFD output; included for parity.
 *
 * @module presentations/volumeOverlay
 */

export type ColormapStops = Array<[number, number, number]>;


export const COLORMAP_VIRIDIS: ColormapStops = [
  [0.267, 0.005, 0.329],
  [0.282, 0.140, 0.458],
  [0.254, 0.265, 0.530],
  [0.207, 0.372, 0.553],
  [0.164, 0.471, 0.558],
  [0.128, 0.567, 0.551],
  [0.135, 0.659, 0.518],
  [0.267, 0.749, 0.441],
  [0.478, 0.821, 0.318],
  [0.741, 0.873, 0.150],
  [0.993, 0.906, 0.144],
];


export const COLORMAP_PLASMA: ColormapStops = [
  [0.050, 0.030, 0.528],
  [0.252, 0.014, 0.610],
  [0.434, 0.005, 0.661],
  [0.595, 0.083, 0.640],
  [0.728, 0.197, 0.564],
  [0.836, 0.317, 0.469],
  [0.918, 0.444, 0.379],
  [0.969, 0.583, 0.290],
  [0.987, 0.733, 0.211],
  [0.964, 0.893, 0.183],
  [0.940, 0.975, 0.131],
];


/** Diverging blue → white → red. Good for signed anomalies. */
export const COLORMAP_COOLWARM: ColormapStops = [
  [0.230, 0.299, 0.754],
  [0.418, 0.530, 0.872],
  [0.603, 0.730, 0.949],
  [0.781, 0.871, 0.974],
  [0.917, 0.954, 0.969],
  [0.969, 0.967, 0.913],
  [0.974, 0.876, 0.785],
  [0.949, 0.730, 0.603],
  [0.872, 0.530, 0.418],
  [0.754, 0.299, 0.230],
  [0.706, 0.016, 0.150],
];


/** Black-body sequence — heatmap "thermal" look. */
export const COLORMAP_THERMAL: ColormapStops = [
  [0.000, 0.000, 0.000],
  [0.150, 0.030, 0.180],
  [0.350, 0.050, 0.250],
  [0.600, 0.150, 0.150],
  [0.800, 0.350, 0.050],
  [0.950, 0.550, 0.050],
  [1.000, 0.750, 0.150],
  [1.000, 0.900, 0.350],
  [1.000, 1.000, 0.700],
  [1.000, 1.000, 0.950],
];


/** Classic CFD rainbow. Included for legacy parity; prefer viridis. */
export const COLORMAP_JET: ColormapStops = [
  [0.000, 0.000, 0.500],
  [0.000, 0.000, 1.000],
  [0.000, 0.500, 1.000],
  [0.000, 1.000, 1.000],
  [0.500, 1.000, 0.500],
  [1.000, 1.000, 0.000],
  [1.000, 0.500, 0.000],
  [1.000, 0.000, 0.000],
  [0.500, 0.000, 0.000],
];


/** Named colormap registry. Used by the panel's picker. */
export const COLORMAPS: Record<string, ColormapStops> = {
  viridis:  COLORMAP_VIRIDIS,
  plasma:   COLORMAP_PLASMA,
  coolwarm: COLORMAP_COOLWARM,
  thermal:  COLORMAP_THERMAL,
  jet:      COLORMAP_JET,
};


/**
 * Sample a colormap at `t ∈ [0, 1]`. Linearly interpolates between
 * adjacent stops. Clamps out-of-range inputs at the endpoints.
 */
export function sampleColormap(
  stops: ColormapStops,
  t: number,
): [number, number, number] {
  if (stops.length === 0) return [0.5, 0.5, 0.5];
  if (stops.length === 1) return stops[0];
  if (t <= 0) return stops[0];
  if (t >= 1) return stops[stops.length - 1];
  const segs   = stops.length - 1;
  const scaled = t * segs;
  const i      = Math.floor(scaled);
  const f      = scaled - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [
    a[0] * (1 - f) + b[0] * f,
    a[1] * (1 - f) + b[1] * f,
    a[2] * (1 - f) + b[2] * f,
  ];
}


/** Build a CSS `linear-gradient(...)` string from a colormap. Useful
 *  for legend bars in the panel UI. */
export function colormapToCssGradient(stops: ColormapStops): string {
  return "linear-gradient(to right, " + stops.map((c, i) => {
    const pct = (i / (stops.length - 1)) * 100;
    return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)}) ${pct}%`;
  }).join(", ") + ")";
}
