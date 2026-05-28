/**
 * Constructor parameters for the {@link Sky} effect attached at
 * {@link Effects.sky}.
 *
 * The renderer reads these fields on every sky draw, so writing to
 * the {@link Sky} setters at runtime takes effect on the next
 * frame — useful for any feature that needs the visible sky to
 * track the sun, such as {@link presentations!sunStudy.SunStudy | SunStudy}.
 *
 * @module viewing/viewer
 */
export interface SkyParams {

  /**
   * Whether to draw the procedural sky background at all. When
   * `false`, the renderer falls through to whatever was already in
   * the clear buffer. Default `true`.
   */
  enabled?: boolean;

  /** Sky zenith colour. Default `[0.74, 0.80, 0.88]`. */
  skyColor?: [number, number, number];

  /** Horizon colour. Default `[0.66, 0.72, 0.74]`. */
  horizonColor?: [number, number, number];

  /** Below-horizon ground colour. Default `[0.58, 0.64, 0.60]`. */
  groundColor?: [number, number, number];

  /** Angular width of the horizon blend band. Default `0.5`. */
  horizonBlend?: number;

  /** Draw a sun disc + glow. Default `true`. */
  sunEnabled?: boolean;

  /**
   * World-space direction **toward** the sun (sign is the opposite
   * of a {@link DirLight | DirLight}'s `dir`, which points the way
   * photons travel). Need not be normalized. Default
   * `[0.577, 0.577, 0.577]`.
   */
  sunDirection?: [number, number, number];

  /** Sun disc + corona colour. Default `[1.0, 0.97, 0.82]`. */
  sunColor?: [number, number, number];

  /** Sun disc angular diameter in degrees. Default `3`. */
  sunAngularSize?: number;

  /** Exponent controlling how tightly the glow hugs the disc. Default `16`. */
  sunGlowSize?: number;

  /** Peak intensity of the sun glow. Default `0.25`. */
  sunGlowIntensity?: number;

  /** World-space "up" direction. Default `[0, 0, 1]` (Z-up). */
  worldUp?: [number, number, number];
}
