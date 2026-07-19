// Shows thermal flow in an atrium with volume overlays for streamlines, slices
// and iso-surfaces.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;
  const vol = xeokit.presentations.volumeOverlay;

  // ── Atrium dimensions (metres) ──────────────────────────────────
  // Two-storey atrium with a wrap-around mezzanine on three sides
  // (back, left, right), leaving the front + centre open for the
  // updraft from the heat-source plinth to rise through the full
  // 12 m height. Geometry is deliberately busy enough that the
  // volumetric data has architecture to negotiate around —
  // streamlines bending under the mezzanine deck, slice planes
  // cutting through interior partitions, iso-surfaces wrapping
  // around the plinth.
  const W = 20, D = 20, H = 12;
  const MEZZ_Z = 5;              // mezzanine slab height
  const MEZZ_DEPTH = 5;          // how far the mezzanine extends inward
  const PLINTH_X = -3, PLINTH_Y = -3;   // heat-source plinth location
  const PLINTH_R = 1.2;          // plinth footprint half-width
  const PLINTH_H = 1.6;          // plinth height

  // ── Procedural atrium scene ─────────────────────────────────────
  const sceneModel = mustCreate(scene.createModel({ id: "atrium" }));

  mustCreate(sceneModel.createGeometry({
    id: "boxGeom",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: new Float32Array([
      -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5,
      -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    ]),
    indices: new Uint32Array([
      0,1,2, 0,2,3,        // -Z
      4,6,5, 4,7,6,        // +Z
      0,4,5, 0,5,1,        // -Y
      2,6,7, 2,7,3,        // +Y
      0,3,7, 0,7,4,        // -X
      1,5,6, 1,6,2,        // +X
    ]),
  }));

  // Materials.
  //   - Walls (perimeter): translucent so streamlines / slice / iso
  //     read through them.
  //   - Floor: opaque concrete-ish — visual anchor.
  //   - Mezzanine: same as walls but slightly more opaque since
  //     it's a horizontal surface that the streamlines pass under.
  //   - Plinth: warm reddish — visual hint of "this is the heat
  //     source" matching the volumetric plume's centre.
  //   - Glass: very translucent so the central column of glazing
  //     reads as an architectural feature without occluding.
  mustCreate(sceneModel.createMaterial({
    id: "matWall", color: [0.86, 0.86, 0.88],
    opacity: 0.18, roughness: 0.85, metallic: 0.0,
  }));
  mustCreate(sceneModel.createMaterial({
    id: "matFloor", color: [0.55, 0.55, 0.56],
    opacity: 1.0, roughness: 0.92, metallic: 0.0,
  }));
  mustCreate(sceneModel.createMaterial({
    id: "matMezz", color: [0.78, 0.74, 0.68],
    opacity: 0.45, roughness: 0.80, metallic: 0.0,
  }));
  mustCreate(sceneModel.createMaterial({
    id: "matPlinth", color: [0.72, 0.30, 0.18],
    opacity: 1.0, roughness: 0.55, metallic: 0.0,
  }));
  mustCreate(sceneModel.createMaterial({
    id: "matGlass", color: [0.55, 0.72, 0.85],
    opacity: 0.18, roughness: 0.10, metallic: 0.0,
  }));
  mustCreate(sceneModel.createMaterial({
    id: "matRailing", color: [0.20, 0.22, 0.26],
    opacity: 0.85, roughness: 0.60, metallic: 0.30,
  }));

  // Helper — emit a box instance translated + scaled into the
  // 1×1×1 boxGeom.
  let pieceCount = 0;
  function addBox(cx, cy, cz, sx, sy, sz, matId) {
    const id = `piece${pieceCount++}`;
    mustCreate(sceneModel.createMesh({
      id: `${id}_mesh`,
      geometryId: "boxGeom",
      materialId: matId,
      matrix: new Float32Array([
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
        cx, cy, cz, 1,
      ]),
    }));
    mustCreate(sceneModel.createObject({ id, meshIds: [`${id}_mesh`] }));
  }

  // ── Shell: floor + three perimeter walls (no front, no ceiling) ─
  const t = 0.2;
  const halfW = W / 2;
  const halfD = D / 2;
  addBox(0, 0,  -t/2,         W, D, t,          "matFloor");
  addBox(-halfW - t/2, 0, H/2, t, D, H,         "matWall");        // -X
  addBox( halfW + t/2, 0, H/2, t, D, H,         "matWall");        // +X
  addBox(0,  halfD + t/2, H/2, W + 2*t, t, H,   "matWall");        // +Y back

  // ── Curtain wall: vertical strip of glass on the back wall ─────
  // Two slim mullions framing a vision-glass panel — a recognisable
  // architectural feature without adding occlusion.
  const glassW = 7, glassH = 8;
  addBox( -glassW/2 - 0.05, halfD - 0.1, H/2,  0.1, 0.05, glassH,  "matRailing");   // L mullion
  addBox(  glassW/2 + 0.05, halfD - 0.1, H/2,  0.1, 0.05, glassH,  "matRailing");   // R mullion
  addBox( 0,                halfD - 0.05, H/2 + 0.5, glassW, 0.05, glassH, "matGlass");

  // ── Mezzanine slab — U-shape leaving the central + front open ──
  // Three slabs wrapping around: back, left, right. Streamlines
  // rising in the central atrium void pass between them; floor-
  // level inflow is funnelled under their leading edge.
  const mzt = 0.30;
  addBox(0,                  halfD - MEZZ_DEPTH/2,   MEZZ_Z - mzt/2,  W, MEZZ_DEPTH, mzt, "matMezz");   // back
  addBox(-halfW + MEZZ_DEPTH/2, (MEZZ_DEPTH - D)/2 + MEZZ_DEPTH/2, MEZZ_Z - mzt/2,  MEZZ_DEPTH, D - 2*MEZZ_DEPTH, mzt, "matMezz");   // left wing
  addBox( halfW - MEZZ_DEPTH/2, (MEZZ_DEPTH - D)/2 + MEZZ_DEPTH/2, MEZZ_Z - mzt/2,  MEZZ_DEPTH, D - 2*MEZZ_DEPTH, mzt, "matMezz");   // right wing

  // ── Mezzanine railing — slim dark strip along the inboard edge ─
  // Hints at "this is a usable balcony" without paying full
  // baluster-geometry cost.
  const rH = 1.0;
  addBox(0,                  halfD - MEZZ_DEPTH + 0.05, MEZZ_Z + rH/2,  W - 2*MEZZ_DEPTH, 0.05, rH, "matRailing");
  addBox(-halfW + MEZZ_DEPTH - 0.05, 0,                 MEZZ_Z + rH/2,  0.05, D - 2*MEZZ_DEPTH, rH, "matRailing");
  addBox( halfW - MEZZ_DEPTH + 0.05, 0,                 MEZZ_Z + rH/2,  0.05, D - 2*MEZZ_DEPTH, rH, "matRailing");

  // ── Heat-source plinth + chimney column ────────────────────────
  // Solid plinth at floor level (the visible "where the heat comes
  // from") with a thin chimney column rising to the ceiling — a
  // building-services style stack. Streamlines in the demo field
  // converge on this column's footprint.
  addBox(PLINTH_X, PLINTH_Y, PLINTH_H/2,  PLINTH_R*2, PLINTH_R*2, PLINTH_H, "matPlinth");
  addBox(PLINTH_X, PLINTH_Y, PLINTH_H + (H - PLINTH_H)/2,  0.4, 0.4, H - PLINTH_H, "matRailing");

  // ── Interior partition on the ground floor ─────────────────────
  // A single low wall running parallel to the back, splitting the
  // ground floor in two — gives slice planes an obvious feature
  // to cut through.
  addBox(2.5, 1.5, 1.8/2,  9, 0.15, 1.8, "matWall");

  // ── View ─────────────────────────────────────────────────────────
  // Angled-down view from outside one corner so the streamlines
  // (which fill the volume) read against the floor and the rear
  // wall instead of through the back of the camera.
  studio.viewManager.createView({
    camera: {
      eye:  [ 18, -22, 11],
      look: [-3,   0,  4],
      up:   [  0,   0, 1],
      perspectiveProjection: { near: 0.01, far: 500 },
    },
  });

  // ── Volumetric data ─────────────────────────────────────────────
  // Same demo helpers the toolbar's cold-start path uses. Field
  // covers the atrium's interior bbox (floor → ceiling, wall to wall).
  const min = [-W/2, -D/2, 0];
  const max = [ W/2,  D/2, H];
  const grid       = vol.makeDemoScalarField(min, max, [40, 40, 30]);
  const vectorGrid = vol.makeDemoVectorField (min, max, [30, 30, 20]);

  // Rename for the panel header — the demo helper labels the field
  // "Demo Temperature" which is fine but a bit generic for a
  // showcase. Override for this example.
  grid.name       = "Atrium Air Temperature";
  vectorGrid.name = "Atrium Air Velocity";

  // ── Open the panel ──────────────────────────────────────────────
  studio.panels.open("volumeOverlayPanel", {
    grid,
    vectorGrid,
    scene,
    initialTechnique: "streamlines",  // showcase pick — most striking
    initialColormap:  "viridis",
  });

  studio.finished();

}).catch((err) => {
  console.error("[presentations_volumeOverlay_atrium]", err?.message ?? err, err?.stack ?? "");
});


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
