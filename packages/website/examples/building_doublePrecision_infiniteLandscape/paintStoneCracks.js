// Seamless stone-cracks painter.
//
// Same shape as the SDK painters in
// `packages/sdk/src/model/procgen/paintMaterials/` — takes a square
// texture size and returns a `MaterialMaps` triple (`color`, `normal`,
// `mr`) plus a `flatColor` fallback. Designed to tile cleanly so
// triplanar / UV-wrapped sampling never reveals a wrap seam.
//
// The crack pattern is built from ridged periodic noise: an fBm
// stack is folded around its 0.5 isoline (`1 - |2·fbm - 1|`),
// producing Voronoi-edge-like ridges wherever the underlying noise
// crosses its midpoint. Raising that ridge to a high power
// (`crackSharpness`) collapses it to thin sharp lines; multiplying
// against a second slower fBm modulates crack density so some
// regions read as heavily cracked while others stay smooth.
//
// The crack mask drives three contributions in lockstep:
//   - colour pushed dark inside the crack
//   - height pulled down (cracks read as physical valleys via
//     `heightToNormal`)
//   - roughness pushed higher inside the crack (rough debris in
//     the joint vs polished stone face)

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {
  newPixelBuffer,
  heightToNormal,
  paintMR,
  periodicNoise2,
  periodicFbm,
  clamp01,
} = xeokit.model.procgen.paintMaterials;


/**
 * Paint a seamless stone-cracks PBR material.
 *
 * @param {number} size                  Square texture edge (typically 256–1024).
 * @param {object} [options]
 * @param {number} [options.period=8]    Crack-lattice period — how many crack
 *                                       cells span the texture. Lower = sparser,
 *                                       chunkier cracks.
 * @param {number} [options.crackSharpness=10]  Exponent on the ridge fold. Higher
 *                                       collapses the cracks into thinner lines.
 * @param {number} [options.crackDepth=0.55]    Crack darkening + height-drop strength
 *                                       (0 = no cracks, 1 = pitch-black gouges).
 * @param {number} [options.crackDensity=0.55]  Mid-frequency fBm threshold —
 *                                       higher leaves more area uncracked.
 * @param {[number, number, number]} [options.color=[0.62, 0.60, 0.55]]
 *                                       Base stone albedo.
 * @param {[number, number, number]} [options.crackColor=[0.10, 0.09, 0.08]]
 *                                       Crack-interior albedo (multiplied in).
 * @param {number} [options.normalStrength=4.0]  Bevel strength on the height map.
 * @param {number} [options.roughness=0.85]      Base-face roughness; cracks push higher.
 * @param {number} [options.grainAmp=0.08]       Per-pixel albedo grain amplitude.
 * @returns {{ color: object, normal: object, mr: object, flatColor: [number, number, number] }}
 */
export function paintStoneCracks(size, options = {}) {
  const PERIOD = options.period       ?? 8;
  const SHARP  = options.crackSharpness ?? 10;
  const DEPTH  = options.crackDepth     ?? 0.55;
  const DENS   = options.crackDensity   ?? 0.55;
  const baseColor  = options.color       ?? [0.62, 0.60, 0.55];
  const crackColor = options.crackColor  ?? [0.10, 0.09, 0.08];
  const normalStrength = options.normalStrength ?? 4.0;
  const roughness      = options.roughness      ?? 0.85;
  const grainAmp       = options.grainAmp       ?? 0.08;

  // Crack mask at (px, py) ∈ [0..size)². Returns a value in [0..1]
  // where 1 means "in a crack" and 0 means "clean stone".
  //
  // Three layers compose:
  //   - `ridge` — fold of an fBm stack around 0.5 to produce
  //     Voronoi-edge-like lines. `pow(., SHARP)` collapses them
  //     to thin sharp ridges.
  //   - `density` — a slower fBm that modulates *where* cracks
  //     can appear. Multiplied in so the cracks form a connected
  //     web in some places and leave others smooth, instead of
  //     being uniformly distributed.
  //   - `branchJitter` — a second-octave perturbation of the
  //     ridge so cracks bend and branch rather than running in
  //     straight Voronoi lines.
  function crackMask(px, py) {
    const fx = px / size, fy = py / size;
    const x = fx * PERIOD, y = fy * PERIOD;
    const p = PERIOD;
    // Branch jitter: shift sample point slightly via a coarse
    // periodic noise lookup so the crack lines bend on bigger
    // scales than the noise's own lattice.
    const jx = (periodicNoise2(x * 0.7,        y * 0.7,        p * 0.7,        p * 0.7) - 0.5) * 0.6;
    const jy = (periodicNoise2(x * 0.7 + 17.3, y * 0.7 + 31.1, p * 0.7,        p * 0.7) - 0.5) * 0.6;
    const fbm = periodicFbm(x + jx, y + jy, p, p, 4);
    const ridge = 1 - Math.abs(2 * fbm - 1);          // [0..1], peaks on iso-0.5
    const sharp = Math.pow(ridge, SHARP);              // thin sharp ridges
    // Density: gate cracks behind a slow fBm so some regions are
    // crack-free. `smoothstep`-style ramp around DENS.
    const slow = periodicFbm(x * 0.3, y * 0.3, p * 0.3, p * 0.3, 3);
    const dens = clamp01((slow - DENS) * 6);
    return sharp * dens;
  }

  // Height + colour (one pass — both consume the same crack mask).
  const hgt = newPixelBuffer(size);
  const col = newPixelBuffer(size);
  const hd  = hgt.data;
  const cd  = col.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const m = crackMask(x, y);                 // [0..1] crack mask
      // Stone-face grain: low-amplitude per-pixel speckle plus a
      // mid-frequency fBm that adds patchy tone variation across
      // the stone. Both are scoped down inside cracks (× (1 - m))
      // so the crack interior reads as flat black rather than
      // speckled.
      const grain = (periodicFbm(x * 0.05, y * 0.05, size * 0.05, size * 0.05, 4) - 0.5) * 0.18;
      const spec  = (periodicNoise2(x * 0.5, y * 0.5, size, size) - 0.5) * grainAmp;
      const tint  = grain + spec;

      const r = clamp01(baseColor[0] * (1 + tint) * (1 - m) + crackColor[0] * m);
      const g = clamp01(baseColor[1] * (1 + tint) * (1 - m) + crackColor[1] * m);
      const b = clamp01(baseColor[2] * (1 + tint) * (1 - m) + crackColor[2] * m);

      // Height: stone face sits at ~0.7 with some grain. Cracks
      // pull the height down sharply (× DEPTH). The
      // height-to-normal pass then turns that into recessed
      // valleys with the slope set by `normalStrength`.
      const h = clamp01(0.70 + tint * 0.5 - m * DEPTH);

      const i = (y * size + x) * 4;
      cd[i    ] = Math.round(r * 255);
      cd[i + 1] = Math.round(g * 255);
      cd[i + 2] = Math.round(b * 255);
      cd[i + 3] = 255;
      const hv = Math.round(h * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = hv;
      hd[i + 3] = 255;
    }
  }

  // MR: roughness pushes higher inside the crack. Metallic stays
  // 0 throughout — stone is a dielectric regardless of state.
  const mr = paintMR(size, (x, y) => [
    clamp01(roughness + 0.10 * crackMask(x, y)),
    0,
  ]);

  return {
    color:  col,
    normal: heightToNormal(hgt, normalStrength),
    mr,
    flatColor: baseColor,
  };
}
