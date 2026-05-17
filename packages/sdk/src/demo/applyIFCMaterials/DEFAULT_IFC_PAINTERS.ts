import {
  paintAsphalt,
  paintBrushSteel,
  paintConcrete,
  paintGlass,
  paintLimestone,
  paintOak,
  paintPlaster,
  paintPolSteel,
  paintWoodPlank,
} from "../../model/procgen/paintMaterials";
import {HATCH_STYLE_PRESETS, type HatchFamily, type HatchParams, type HatchStyle} from "../../model/scene/hatchPattern";

import type {IfcPainterEntry} from "./IfcPainterEntry";


// ── Per-material colour tints ──────────────────────────────────────
//
// These compensate for the diffuse `albedo / π` term in the
// Cook-Torrance BRDF — without them, textured materials render
// visibly dim. Same multipliers the materials chart demo uses.

const DIFFUSE_TINT: [number, number, number] = [1.6, 1.6, 1.6];
const METAL_TINT:   [number, number, number] = [1.2, 1.2, 1.2];
const NEUTRAL_TINT: [number, number, number] = [1.0, 1.0, 1.0];


/**
 * Pixel → world-units scale applied to the named hatch presets
 * when promoting them to world-space hatching. The presets in
 * {@link HATCH_STYLE_PRESETS} are tuned for screen-space (~8 px
 * spacing); for engineering plan / section views the same
 * cadence should be on the order of 10–20 cm of building
 * geometry, so we scale by ~1 px = 2 cm. Adjust per-call via
 * the `worldScale` arg if your asset is unusually large or small.
 */
const HATCH_PX_TO_WORLD = 0.02;

/**
 * Build a world-space {@link HatchParams} from one of the named ANSI /
 * ISO {@link HatchStyle} presets, parameterised with an ink colour
 * and optional opacity. Used to attach engineering hatch
 * conventions to the IFC type painters below.
 *
 * The preset's pixel-space spacings (`spacing`, `lineWidth`,
 * `phase`, `amplitude`, `wavelength`, `brickHeight`,
 * `courseOffset`) are multiplied by {@link HATCH_PX_TO_WORLD}
 * so the resulting world-space hatch reads at engineering scale
 * (~16 cm spacing for ANSI 31/32 on a metres-unit BIM model).
 */
function hatch(
  style: HatchStyle,
  inkColor: [number, number, number],
  opacity: number = 1.0,
  worldScale: number = HATCH_PX_TO_WORLD,
): HatchParams {
  const scaled = HATCH_STYLE_PRESETS[style].map(f => ({
    ...f,
    spacing:      f.spacing      * worldScale,
    lineWidth:    f.lineWidth    * worldScale,
    phase:        f.phase        !== undefined ? f.phase * worldScale : undefined,
    amplitude:    f.amplitude    !== undefined ? f.amplitude * worldScale : undefined,
    wavelength:   f.wavelength   !== undefined ? f.wavelength * worldScale : undefined,
    brickHeight:  f.brickHeight  !== undefined ? f.brickHeight * worldScale : undefined,
    courseOffset: f.courseOffset !== undefined ? f.courseOffset * worldScale : undefined,
  })) as HatchFamily[];
  return {
    families: scaled,
    color:    inkColor,
    opacity,
    space:    "world",
  };
}


/**
 * Default IFC type → painter mapping. Targets the common IFC4
 * building elements; override or extend via the `painters` option of
 * {@link applyIFCMaterials}.
 */
export const DEFAULT_IFC_PAINTERS: Record<string, IfcPainterEntry> = {

  // ── Walls and finishes ─────────────────────────────────────────
  //
  // Hatch conventions follow engineering drawing practice:
  //   Wall (wood plank cladding) → ANSI 31 dense diagonal (wood).
  //   Plaster / covering          → ANSI 38 dot grid (porous).
  //   Curtain wall / window       → no hatch (transparent dielectric).

  IfcWall: {
    paint:    paintWoodPlank,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi31", [0.22, 0.12, 0.06])},
  },
  IfcWallStandardCase: {
    paint:    paintWoodPlank,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi31", [0.22, 0.12, 0.06])},
  },
  IfcCovering: {
    paint:    paintPlaster,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi38", [0.32, 0.32, 0.32], 0.65)},
  },
  IfcCurtainWall: {
    paint:    paintGlass,
    material: {color: NEUTRAL_TINT, opacity: 0.35, alphaMode: "BLEND"},
  },

  // ── Floors / slabs / roofs ─────────────────────────────────────
  //
  // Slabs use a bumpier concrete than the default — coarser noise
  // period + amplified normal-map strength makes the heightfield
  // showcase the PBR normal-mapping pipeline (visible relief under
  // the IBL specular, with the directional sun raking across the
  // surface). Hatch: ISO concrete fine for slabs (the engineering
  // section-fill standard); ANSI 31 dense diagonal for asphalt
  // roofs (aggregate read).

  IfcSlab: {
    paint: (size) => paintConcrete(size, {
      noisePeriod:    10,
      normalStrength: 4.0,
      roughness:      0.78,
    }),
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("isoConcreteFine", [0.34, 0.34, 0.32])},
  },

  IfcRoof: {
    paint:    paintAsphalt,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi31", [0.16, 0.16, 0.16])},
  },

  // ── Structural frame ───────────────────────────────────────────
  //
  // Beam / column default to a concrete fill (matches the painter)
  // — change the painter if your model is steel-framed and the
  // hatch will follow automatically via the `painters` override.
  // Member / Plate / Railing are steel: ANSI 32 crosshatch.

  IfcBeam: {
    paint:    paintConcrete,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("isoConcreteFine", [0.34, 0.34, 0.32])},
  },
  IfcColumn: {
    paint:    paintConcrete,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("isoConcreteFine", [0.34, 0.34, 0.32])},
  },
  IfcMember: {
    paint:    paintPolSteel,
    material: {color: METAL_TINT, hatchPattern: hatch("ansi32", [0.08, 0.08, 0.10])},
  },
  IfcPlate: {
    paint:    paintPolSteel,
    material: {color: METAL_TINT, hatchPattern: hatch("ansi32", [0.08, 0.08, 0.10])},
  },
  IfcRailing: {
    paint:    paintPolSteel,
    material: {color: METAL_TINT, hatchPattern: hatch("ansi32", [0.08, 0.08, 0.10])},
  },

  // ── Openings ───────────────────────────────────────────────────

  IfcWindow: {
    paint:    paintGlass,
    material: {color: NEUTRAL_TINT, opacity: 0.35, alphaMode: "BLEND"},
  },
  IfcDoor: {
    paint:    paintOak,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi31", [0.20, 0.10, 0.04])},
  },

  // ── Furnishing / circulation ───────────────────────────────────
  //
  // Furniture: plaster (catch-all) with a subtle dot fill so
  // sectioned chairs / fixtures still read as solids.
  // Stairs: limestone with an ISO concrete crosshatch — heavier
  // than slab fill since stair sections are typically thicker.

  IfcFurnishingElement: {
    paint:    paintPlaster,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi38", [0.40, 0.40, 0.40], 0.50)},
  },
  IfcFurniture: {
    paint:    paintPlaster,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi38", [0.40, 0.40, 0.40], 0.50)},
  },
  IfcStair: {
    paint:    paintLimestone,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("isoConcreteCoarse", [0.30, 0.30, 0.28])},
  },
  IfcStairFlight: {
    paint:    paintLimestone,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("isoConcreteCoarse", [0.30, 0.30, 0.28])},
  },

  // ── Lighting fixtures ──────────────────────────────────────────
  //
  // Real IFC type — also targeted by the lighting name rule for
  // proxies. Brushed steel reads as a generic fitting under PBR;
  // ANSI 32 crosshatch under engineering section.

  IfcLightFixture: {
    paint:    paintBrushSteel,
    material: {color: METAL_TINT, hatchPattern: hatch("ansi32", [0.08, 0.08, 0.10])},
  },

  // ── Site / topography ──────────────────────────────────────────
  //
  // Real IFC type. Asphalt-style aggregate works for both ground
  // surfaces and parking apron proxies; ANSI 31 dense diagonal
  // matches conventional asphalt section-fill.

  IfcSite: {
    paint:    paintAsphalt,
    material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi31", [0.16, 0.16, 0.16])},
  },

  // ── Synthetic keys targeted by name / property rules ───────────
  //
  // No IFC<2x3 type exists for these — they're routed to from
  // DEFAULT_IFC_NAME_RULES (vegetation, people, vehicles, water,
  // terrain proxies) or user-supplied property rules (e.g. exterior
  // walls). Keep them in the same table so the painter-resolution
  // path is uniform.

  IfcVegetation: {
    // No procedural grass painter exists; tint plaster a muted
    // forest-green (Wong colorblind-safe palette) so trees / shrubs
    // / planting-proxy meshes read as vegetation under PBR lighting.
    // No hatch — vegetation isn't conventionally section-filled.
    paint:    paintPlaster,
    material: {color: [0.22, 0.42, 0.18]},
  },

  IfcPerson: {
    // RPC figures — warm, slightly desaturated tone so populated
    // scenes read as "people are here" without trying to be
    // photoreal skin/clothing. The diffuse tint is muted relative
    // to the other DIFFUSE_TINT entries to keep figures from
    // dominating attention. No hatch — RPC sections aren't
    // meaningful and would clutter the read.
    paint:    paintPlaster,
    material: {color: [1.1, 0.95, 0.85]},
  },

  IfcVehicle: {
    // Polished steel reads convincingly as car bodywork under IBL.
    // ANSI 32 crosshatch for any sectioned vehicle bodywork.
    paint:    paintPolSteel,
    material: {color: METAL_TINT, hatchPattern: hatch("ansi32", [0.08, 0.08, 0.10])},
  },

  IfcWater: {
    // Glass painter, tinted blue, with a translucent BLEND alpha so
    // pools / ponds / fountains read as water surfaces without
    // hiding what's beneath them. No hatch — transparent dielectric.
    paint:    paintGlass,
    material: {color: [0.45, 0.65, 0.85], opacity: 0.55, alphaMode: "BLEND"},
  },

  IfcSiteTerrain: {
    // Bumpier-than-default concrete tinted earth-brown, matching
    // the "ground" feel a topo proxy needs. Same tactic as IfcSlab:
    // amplified normal-map strength to showcase the heightfield
    // under the directional sun. ANSI 38 dot grid for the
    // conventional earth-fill section symbol.
    paint: (size) => paintConcrete(size, {
      noisePeriod:    14,
      normalStrength: 4.0,
      roughness:      0.85,
    }),
    material: {color: [0.85, 0.72, 0.55], hatchPattern: hatch("ansi38", [0.30, 0.20, 0.10])},
  },
};
