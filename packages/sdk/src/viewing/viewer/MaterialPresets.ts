import {HATCH_STYLE_PRESETS, type HatchFamily, type HatchParams} from "../../model/scene/hatchPattern";

/**
 * Spread-able fragments for {@link SceneMaterialParams} carrying
 * conventional engineering / architectural material settings:
 * PBR-ish base values + an ANSI/ISO cross-section hatch in
 * world space.
 *
 * Use by spreading into a material:
 *
 * ```ts
 * sceneModel.fromParams({
 *   materials: [
 *     { id: "beam",   ...MaterialPresets.steel },
 *     { id: "slab",   ...MaterialPresets.concrete },
 *     { id: "facade", ...MaterialPresets.brick, color: [0.55, 0.32, 0.24] },
 *   ],
 *   ...
 * });
 * ```
 *
 * Each preset carries:
 *   - `color`, `roughness`, `metallic` — sensible PBR-ish base
 *     values for realistic lighting.
 *   - `hatchPattern` — world-space hatch using the relevant
 *     ANSI/ISO families. Picked up when caps or body hatching are
 *     enabled.
 *
 * Override any field by adding it AFTER the spread.
 *
 * The preset is just a plain object — no class, no factory.
 * Spreading copies the references, so don't mutate the
 * arrays inside (`hatchPattern.families`) without cloning.
 *
 * @category materials
 */
export const MaterialPresets = {

  /** Steel: ANSI 32 crosshatch over polished metallic base. */
  steel: {
    color: [0.72, 0.74, 0.78],
    roughness: 0.35,
    metallic: 1.0,
    hatchPattern: hatch("ansi32", [0.05, 0.05, 0.07]),
  },

  /** Cast iron: ANSI 31 single 45° diagonal over duller steel base. */
  castIron: {
    color: [0.42, 0.42, 0.44],
    roughness: 0.60,
    metallic: 0.85,
    hatchPattern: hatch("ansi31", [0.07, 0.07, 0.07]),
  },

  /** Bronze: ANSI 33 alternating diagonal lines over warm metal base. */
  bronze: {
    color: [0.65, 0.50, 0.28],
    roughness: 0.45,
    metallic: 0.95,
    hatchPattern: hatch("ansi33", [0.20, 0.14, 0.04]),
  },

  /** Insulation: ANSI 37 wavy diagonal lines over neutral grey. */
  insulation: {
    color: [0.85, 0.83, 0.78],
    roughness: 0.95,
    metallic: 0.0,
    hatchPattern: hatch("ansi37", [0.30, 0.30, 0.30]),
  },

  /** Plastic / lead: ANSI 38 dot grid over a soft neutral. */
  plastic: {
    color: [0.78, 0.78, 0.80],
    roughness: 0.55,
    metallic: 0.0,
    hatchPattern: hatch("ansi38", [0.20, 0.20, 0.22]),
  },

  /** Brick / masonry: ANSI 36 running-bond brick over warm tone. */
  brick: {
    color: [0.62, 0.36, 0.28],
    roughness: 0.90,
    metallic: 0.0,
    hatchPattern: hatch("ansi36", [0.28, 0.14, 0.10]),
  },

  /** Concrete (fine): ISO single-direction 45° hatch over light grey. */
  concrete: {
    color: [0.72, 0.72, 0.68],
    roughness: 0.85,
    metallic: 0.0,
    hatchPattern: hatch("isoConcreteFine", [0.38, 0.38, 0.36]),
  },

  /** Heavy concrete: coarser ISO crosshatch for thick sections. */
  concreteHeavy: {
    color: [0.66, 0.66, 0.62],
    roughness: 0.92,
    metallic: 0.0,
    hatchPattern: hatch("isoConcreteCoarse", [0.32, 0.32, 0.30]),
  },

  /** Glass: no hatch, low roughness, glassy tint. Cap (when sliced) renders capColor only. */
  glass: {
    color: [0.85, 0.92, 0.95],
    roughness: 0.05,
    metallic: 0.0,
    opacity: 0.45,
  },

  /** Wood: ANSI 31-style dense diagonal over warm brown. */
  wood: {
    color: [0.55, 0.36, 0.20],
    roughness: 0.75,
    metallic: 0.0,
    hatchPattern: hatch("ansi31", [0.20, 0.10, 0.05]),
  },

  /** Earth / soil fill: ANSI 38 dot grid over warm brown. */
  earth: {
    color: [0.48, 0.36, 0.22],
    roughness: 0.95,
    metallic: 0.0,
    hatchPattern: hatch("ansi38", [0.22, 0.14, 0.06]),
  },
};

/**
 * Pixel → world-units scale applied when promoting a pixel-tuned
 * hatch preset to a world-space hatch. The presets in
 * {@link HATCH_STYLE_PRESETS} use ~8 px spacing; world-space
 * engineering reads want 10–20 cm of geometry per cycle on a
 * metres-unit model — hence ~1 px = 2 cm.
 */
const HATCH_PX_TO_WORLD = 0.02;

/**
 * Resolves an ANSI/ISO {@link HatchStyle} preset to a world-space
 * {@link HatchParams} fragment with the given ink colour. Used
 * internally by {@link MaterialPresets}; exported so callers
 * building their own conventions can compose the same way.
 *
 * Scales the preset's pixel-space spacings by
 * {@link HATCH_PX_TO_WORLD} so the resulting hatch reads at
 * engineering scale on metres-unit BIM geometry.
 */
function hatch(
  style: keyof typeof HATCH_STYLE_PRESETS,
  inkColor: [number, number, number],
): HatchParams {
  const scaled = HATCH_STYLE_PRESETS[style].map(f => ({
    ...f,
    spacing:      f.spacing      * HATCH_PX_TO_WORLD,
    lineWidth:    f.lineWidth    * HATCH_PX_TO_WORLD,
    phase:        f.phase        !== undefined ? f.phase        * HATCH_PX_TO_WORLD : undefined,
    amplitude:    f.amplitude    !== undefined ? f.amplitude    * HATCH_PX_TO_WORLD : undefined,
    wavelength:   f.wavelength   !== undefined ? f.wavelength   * HATCH_PX_TO_WORLD : undefined,
    brickHeight:  f.brickHeight  !== undefined ? f.brickHeight  * HATCH_PX_TO_WORLD : undefined,
    courseOffset: f.courseOffset !== undefined ? f.courseOffset * HATCH_PX_TO_WORLD : undefined,
  })) as HatchFamily[];
  return {
    families: scaled,
    color:    inkColor,
    space:    "world",
  };
}
