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
} from "../../procgen/paintMaterials";

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
 * Default IFC type → painter mapping. Targets the common IFC4
 * building elements; override or extend via the `painters` option of
 * {@link applyIFCMaterials}.
 */
export const DEFAULT_IFC_PAINTERS: Record<string, IfcPainterEntry> = {

  // ── Walls and finishes ─────────────────────────────────────────

  IfcWall:               {paint: paintWoodPlank, material: {color: DIFFUSE_TINT}},
  IfcWallStandardCase:   {paint: paintWoodPlank, material: {color: DIFFUSE_TINT}},
  IfcCovering:           {paint: paintPlaster,   material: {color: DIFFUSE_TINT}},
  IfcCurtainWall:        {paint: paintGlass,     material: {color: NEUTRAL_TINT, opacity: 0.35, alphaMode: "BLEND"}},

  // ── Floors / slabs / roofs ─────────────────────────────────────
  //
  // Slabs use a bumpier concrete than the default — coarser noise
  // period + amplified normal-map strength makes the heightfield
  // showcase the PBR normal-mapping pipeline (visible relief under
  // the IBL specular, with the directional sun raking across the
  // surface).

  IfcSlab: {
    paint: (size) => paintConcrete(size, {
      noisePeriod:    10,
      normalStrength: 4.0,
      roughness:      0.78,
    }),
    material: {color: DIFFUSE_TINT},
  },

  IfcRoof:               {paint: paintAsphalt,   material: {color: DIFFUSE_TINT}},

  // ── Structural frame ───────────────────────────────────────────

  IfcBeam:               {paint: paintConcrete,  material: {color: DIFFUSE_TINT}},
  IfcColumn:             {paint: paintConcrete,  material: {color: DIFFUSE_TINT}},
  IfcMember:             {paint: paintPolSteel,  material: {color: METAL_TINT}},
  IfcPlate:              {paint: paintPolSteel,  material: {color: METAL_TINT}},
  IfcRailing:            {paint: paintPolSteel,  material: {color: METAL_TINT}},

  // ── Openings ───────────────────────────────────────────────────

  IfcWindow:             {paint: paintGlass,     material: {color: NEUTRAL_TINT, opacity: 0.35, alphaMode: "BLEND"}},
  IfcDoor:               {paint: paintOak,       material: {color: DIFFUSE_TINT}},

  // ── Furnishing / circulation ───────────────────────────────────

  IfcFurnishingElement:  {paint: paintPlaster,   material: {color: DIFFUSE_TINT}},
  IfcFurniture:          {paint: paintPlaster,   material: {color: DIFFUSE_TINT}},
  IfcStair:              {paint: paintLimestone, material: {color: DIFFUSE_TINT}},
  IfcStairFlight:        {paint: paintLimestone, material: {color: DIFFUSE_TINT}},

  // ── Lighting fixtures ──────────────────────────────────────────
  //
  // Real IFC type — also targeted by the lighting name rule for
  // proxies. Brushed steel reads as a generic fitting under PBR.

  IfcLightFixture:       {paint: paintBrushSteel, material: {color: METAL_TINT}},

  // ── Site / topography ──────────────────────────────────────────
  //
  // Real IFC type. Asphalt-style aggregate works for both ground
  // surfaces and parking apron proxies; matches what the terrain
  // name rule expects.

  IfcSite:               {paint: paintAsphalt,    material: {color: DIFFUSE_TINT}},

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
    paint:    paintPlaster,
    material: {color: [0.22, 0.42, 0.18]},
  },

  IfcPerson: {
    // RPC figures — warm, slightly desaturated tone so populated
    // scenes read as "people are here" without trying to be
    // photoreal skin/clothing. The diffuse tint is muted relative
    // to the other DIFFUSE_TINT entries to keep figures from
    // dominating attention.
    paint:    paintPlaster,
    material: {color: [1.1, 0.95, 0.85]},
  },

  IfcVehicle: {
    // Polished steel reads convincingly as car bodywork under IBL.
    paint:    paintPolSteel,
    material: {color: METAL_TINT},
  },

  IfcWater: {
    // Glass painter, tinted blue, with a translucent BLEND alpha so
    // pools / ponds / fountains read as water surfaces without
    // hiding what's beneath them.
    paint:    paintGlass,
    material: {color: [0.45, 0.65, 0.85], opacity: 0.55, alphaMode: "BLEND"},
  },

  IfcSiteTerrain: {
    // Bumpier-than-default concrete tinted earth-brown, matching
    // the "ground" feel a topo proxy needs. Same tactic as IfcSlab:
    // amplified normal-map strength to showcase the heightfield
    // under the directional sun.
    paint: (size) => paintConcrete(size, {
      noisePeriod:    14,
      normalStrength: 4.0,
      roughness:      0.85,
    }),
    material: {color: [0.85, 0.72, 0.55]},
  },
};
