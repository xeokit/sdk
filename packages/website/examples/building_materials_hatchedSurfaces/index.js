// SceneMaterial — hatch patterns on triangle surfaces, with
// runtime switching between screen-, world-, and tangent-space
// coordinate modes and a tour of the ANSI / ISO preset library.
//
// Six boxes laid out in a row, each carrying a SceneMaterial
// with a different preset:
//
//   matSolid   — no hatch (control).
//   matCross   — ANSI32 steel (45° + −45° line crosshatch).
//   matBrick   — ANSI36 masonry (brick lattice, type "brick").
//   matWavy    — ANSI37 insulation (wavy lines, type "wavy").
//   matDots    — ANSI38 dots (uniform dot grid, type "dot").
//   matCustom  — three-family custom hatch (line, illustrative).
//
// The space picker swaps every hatched material's `space` at
// runtime between:
//
//   screen   — units in pixels, camera-locked.
//   world    — units in world coords, locked to the world XY
//              plane. Faces parallel to a family's normal show
//              no ink for that family (the line planes don't
//              cross the face).
//   tangent  — units in world coords, projected onto a per-
//              fragment surface basis built from
//              `dFdx/dFdy(vWorldPos)`. The hatch follows the
//              surface; curved geometry (out of scope of this
//              flat-box demo, but try it on a sphere) shows
//              uniform-density hatching regardless of camera
//              angle.
//
// To make the screen / world / tangent toggle meaningful, the
// preset's pixel-unit length fields are rescaled by a factor
// when switching to world or tangent. The boxes are 4 world
// units wide; the scale below maps a 10 px screen spacing to
// a ~0.2 world-unit spacing, giving comparable density at the
// demo's default zoom.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const SCREEN_TO_WORLD = 1 / 50;

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene} = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [0,  -32, 10],
      look: [0,   0,  2],
      up:   [0,   0,  1],
    },
  });

  new xeokit.studio.navCube.NavCube({
    view,
    cameraFlight: studio.views[view.id].cameraFlight,
    cameraFly: false,
    size: 110,
  });

  // ── Material → preset name mapping ──
  //
  // Each material is bound to one preset name from
  // HATCH_STYLE_PRESETS. The space toggle below rebuilds the
  // material's HatchParams from this preset at runtime — pixel
  // lengths in the preset table get rescaled for world / tangent
  // modes via SCREEN_TO_WORLD.
  const materialPresets = {
    matSolid:   "solid",
    matCross:   "ansi32",
    matBrick:   "ansi36",
    matWavy:    "ansi37",
    matDots:    "ansi38",
    matCustom:  null,    // custom three-family pattern — defined below
  };

  // Custom three-family pattern, kept in pixel units so the
  // rescale helper below treats it like a preset.
  const customFamilies = [
    {angle:  30, spacing: 10, lineWidth: 1.5},
    {angle:  90, spacing: 10, lineWidth: 1.5},
    {angle: 150, spacing: 10, lineWidth: 1.5},
  ];

  // Per-material surface colour. Kept stable across mode swaps.
  const surfaceColors = {
    matSolid:  [0.78, 0.55, 0.35],
    matCross:  [0.70, 0.72, 0.80],   // pale steel-blue
    matBrick:  [0.78, 0.62, 0.50],   // terracotta
    matWavy:   [0.95, 0.92, 0.80],   // pale insulation cream
    matDots:   [0.85, 0.85, 0.82],   // light concrete grey
    matCustom: [0.95, 0.92, 0.88],
  };

  // Custom material's ink colour — saturated for visibility.
  const surfaceInk = {
    matCustom: [0.55, 0.15, 0.35],
  };

  const sceneModel = mustCreate(scene.createModel({id: "hatchedSurfaces"}));

  let currentSpace = "screen";

  const initialMaterials = Object.keys(materialPresets).map((id) => ({
    id,
    color: surfaceColors[id],
    hatchPattern: buildHatchPattern(id, currentSpace),
  }));

  // Sphere geometry, built procedurally. UVs aren't needed by
  // the hatch shader (hatch reads gl_FragCoord / vWorldPos),
  // but normals are — they route the meshes into the
  // smooth-shaded Lambert variant, which is what the hatch FS
  // overlay lives on. The flat-shaded variant works too, but
  // smooth shading reads better on the curved surface and
  // shows the hatch following the surface curvature in
  // tangent-space mode.
  const sphere = mustOk(xeokit.model.procgen.buildGeometry.buildSphere({
    radius: 1,
    widthSegments: 32,
    heightSegments: 24,
  }));

  // Six (cube + sphere-on-top) pairs along X. The sphere sits
  // on the cube's top face, sharing the cube's material so
  // both surfaces show the same hatch — picks out how the
  // hatch behaves on curved geometry (especially under
  // tangent-space mode).
  const positions = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
  const materialOrder = ["matSolid", "matCross", "matBrick", "matWavy", "matDots", "matCustom"];
  const meshes = [];
  const objects = [];
  for (let i = 0; i < positions.length; i++) {
    const x = positions[i];
    const matId = materialOrder[i];
    meshes.push({
      id: `box_m${i}`,
      geometryId: "box",
      position: [x, 0, 0],
      scale: [2, 2, 2],
      materialId: matId,
    });
    meshes.push({
      id: `sphere_m${i}`,
      // Sphere centre at z = 2 (cube top) + 1.2 (radius * scale) — so
      // the sphere rests on the cube's top face with a small visual
      // gap that helps the pair read as two distinct objects.
      geometryId: "sphere",
      position: [x, 0, 3.2],
      scale: [1.2, 1.2, 1.2],
      materialId: matId,
    });
    objects.push({id: `obj_box_${i}`,    meshIds: [`box_m${i}`]});
    objects.push({id: `obj_sphere_${i}`, meshIds: [`sphere_m${i}`]});
  }

  mustCreate(sceneModel.fromParams({
    materials: initialMaterials,
    geometries: [
      {
        id: "box",
        primitive: xeokit.base.constants.TrianglesPrimitive,
        positions: [
           1,  1,  1,  -1,  1,  1,  -1, -1,  1,   1, -1,  1,
           1,  1,  1,   1, -1,  1,   1, -1, -1,   1,  1, -1,
           1,  1,  1,   1,  1, -1,  -1,  1, -1,  -1,  1,  1,
          -1,  1,  1,  -1,  1, -1,  -1, -1, -1,  -1, -1,  1,
          -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,
           1, -1, -1,  -1, -1, -1,  -1,  1, -1,   1,  1, -1,
        ],
        // Per-vertex normals so the cubes share the same
        // smooth-shaded technique variant as the spheres
        // (otherwise the cube would land in a flat-shaded
        // batch with a different shader program and a separate
        // pass over the hatch tables). Normal per duplicated
        // corner — same value across the three faces meeting
        // there. The Lambert path reads these as smooth
        // per-vertex normals, which is fine for a low-poly
        // cube because face boundaries are at hard corners.
        normals: [
          0, 0, 1,    0, 0, 1,    0, 0, 1,    0, 0, 1,
          1, 0, 0,    1, 0, 0,    1, 0, 0,    1, 0, 0,
          0, 1, 0,    0, 1, 0,    0, 1, 0,    0, 1, 0,
         -1, 0, 0,   -1, 0, 0,   -1, 0, 0,   -1, 0, 0,
          0,-1, 0,    0,-1, 0,    0,-1, 0,    0,-1, 0,
          0, 0,-1,    0, 0,-1,    0, 0,-1,    0, 0,-1,
        ],
        indices: [
          0, 1, 2,    0, 2, 3,
          4, 5, 6,    4, 6, 7,
          8, 9, 10,   8, 10, 11,
          12, 13, 14, 12, 14, 15,
          16, 17, 18, 16, 18, 19,
          20, 21, 22, 20, 22, 23,
        ],
      },
      {
        id: "sphere",
        primitive: xeokit.base.constants.TrianglesPrimitive,
        positions: sphere.positions,
        normals:   sphere.normals,
        indices:   sphere.indices,
      },
    ],
    meshes,
    objects,
  }));

  // ── Space picker ──
  //
  // Each click iterates every material and reassigns its
  // hatchPattern with the new space mode. The
  // SceneMaterial.hatchPattern setter re-normalises, fires
  // `onSceneMaterialPatternChanged`, and the renderer event
  // path re-encodes the slot in the per-batch
  // HatchPatternTexture — no model rebuild.
  const picker = document.getElementById("spacePicker");
  const buttons = Array.from(picker.querySelectorAll("button"));
  function applySpace(space) {
    currentSpace = space;
    for (const id of Object.keys(materialPresets)) {
      const material = sceneModel.materials[id];
      if (!material) continue;
      material.hatchPattern = buildHatchPattern(id, space);
    }
    for (const btn of buttons) {
      btn.setAttribute("aria-pressed", String(btn.dataset.space === space));
    }
  }
  picker.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const space = target.dataset.space;
    if (space !== "screen" && space !== "world" && space !== "tangent") return;
    applySpace(space);
  });
  applySpace(currentSpace);

  studio.finished();


  // ── Helpers ──

  // Build a HatchParams for the supplied material id in the
  // supplied space. Pulls the preset's families from the SDK's
  // HATCH_STYLE_PRESETS table (or uses customFamilies for the
  // custom material), rescales the length fields by
  // SCREEN_TO_WORLD when the target space isn't "screen", and
  // tags the resulting params with the requested space + the
  // material's ink colour.
  function buildHatchPattern(materialId, space) {
    const presetName = materialPresets[materialId];
    let families;
    if (materialId === "matCustom") {
      families = customFamilies;
    } else if (presetName) {
      const preset = xeokit.model.scene.HATCH_STYLE_PRESETS[presetName];
      families = preset || [];
    } else {
      families = [];
    }
    const scale = space === "screen" ? 1 : SCREEN_TO_WORLD;
    const scaled = families.map((fam) => rescaleFamily(fam, scale));
    const color = surfaceInk[materialId] || [0.10, 0.10, 0.15];
    return {
      families: scaled,
      color,
      opacity: materialId === "matCustom" ? 0.85 : 1.0,
      space,
    };
  }
});


// Rescale a HatchFamily's length-valued fields by `scale`.
// Used to convert a preset's pixel-unit defaults into
// world-/tangent-unit values when the active space switches.
// Non-length fields (angle, type) pass through unchanged.
function rescaleFamily(fam, scale) {
  const out = {
    angle:     fam.angle,
    spacing:   fam.spacing   * scale,
    lineWidth: fam.lineWidth * scale,
  };
  if (fam.type)         out.type         = fam.type;
  if (fam.phase        !== undefined) out.phase        = fam.phase        * scale;
  if (fam.amplitude    !== undefined) out.amplitude    = fam.amplitude    * scale;
  if (fam.wavelength   !== undefined) out.wavelength   = fam.wavelength   * scale;
  if (fam.brickHeight  !== undefined) out.brickHeight  = fam.brickHeight  * scale;
  if (fam.courseOffset !== undefined) out.courseOffset = fam.courseOffset * scale;
  return out;
}


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function mustOk(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
