// SceneMaterial — runtime mutation of `linePattern` + `hatchPattern`.
//
// Two materials drive the scene:
//
//   - `surfaceMat` — a triangle-surface material whose
//     `hatchPattern` is shown applied to a row of three solid
//     boxes. Clicking a button in the top picker updates the
//     material's `hatchPattern` directly; every box that
//     references the material re-tints on the next frame.
//
//   - `wireMat` — a line-primitive material whose `linePattern`
//     is shown applied to a row of three wireframe boxes.
//
// What the renderer does behind the scenes:
//
//   - `SceneMaterial.hatchPattern = ...` re-normalises the
//     pattern into the material's internal Float32Array buffer.
//   - The setter fires `onSceneMaterialPatternChanged`.
//   - WebGLRenderer subscribes to that event and forwards to
//     ViewManager → GPUMemoryManager → every GPUMemoryBatch's
//     `updateMaterialPattern`.
//   - Each batch looks up the material's slot in its per-batch
//     HatchPatternTexture / LinePatternTexture, calls
//     `setSlot()` to overwrite the slot's texel data, and marks
//     it dirty for upload on the next frame.
//   - Per-mesh attribute texture is left untouched — the slot
//     index there is keyed on `material.uniqueId`, which doesn't
//     change.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene} = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [0,  -22, 6],
      look: [0,   0,  0],
      up:   [0,   0,  1],
    },
  });

  // Lines need to be thick enough that the dash / gap visibility
  // reads at typical screen scales. The View-level value applies
  // wherever a material doesn't override.
  view.linesMaterial.lineWidth = 4;

  const sceneModel = mustCreate(scene.createModel({id: "mutablePatterns"}));

  // ── Geometry definitions ──
  //
  // One triangle-box geometry for the surface row; one
  // wireframe-box (`LinesPrimitive`) for the line row. Reused
  // across three meshes each so the scene has six visible
  // shapes from two geometries.
  const boxLines = mustOk(xeokit.model.procgen.buildGeometry.buildBoxLines({
    xSize: 1, ySize: 1, zSize: 1,
  }));

  mustCreate(sceneModel.fromParams({
    materials: [
      // Single triangle-surface material — its hatchPattern is
      // updated at runtime via the top picker.
      {
        id:           "surfaceMat",
        color:        [0.78, 0.55, 0.35],
        hatchPattern: "diagonalLines",
      },
      // Single line material — its linePattern is updated at
      // runtime via the bottom picker.
      {
        id:           "wireMat",
        color:        [0.10, 0.30, 0.70],
        lineWidth:    4,
        linePattern:  "dashed",
      },
    ],
    geometries: [
      {
        id: "surfaceBox",
        primitive: xeokit.base.constants.TrianglesPrimitive,
        positions: [
           1,  1,  1,  -1,  1,  1,  -1, -1,  1,   1, -1,  1,
           1,  1,  1,   1, -1,  1,   1, -1, -1,   1,  1, -1,
           1,  1,  1,   1,  1, -1,  -1,  1, -1,  -1,  1,  1,
          -1,  1,  1,  -1,  1, -1,  -1, -1, -1,  -1, -1,  1,
          -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,
           1, -1, -1,  -1, -1, -1,  -1,  1, -1,   1,  1, -1,
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
        id: "wireBox",
        primitive: xeokit.base.constants.LinesPrimitive,
        positions: boxLines.positions,
        indices:   boxLines.indices,
      },
    ],
    meshes: [
      // Top row — surface boxes share `surfaceMat`.
      {id: "s0", geometryId: "surfaceBox", position: [-6, 0,  3], scale: [1.4, 1.4, 1.4], materialId: "surfaceMat"},
      {id: "s1", geometryId: "surfaceBox", position: [ 0, 0,  3], scale: [1.4, 1.4, 1.4], materialId: "surfaceMat"},
      {id: "s2", geometryId: "surfaceBox", position: [ 6, 0,  3], scale: [1.4, 1.4, 1.4], materialId: "surfaceMat"},
      // Bottom row — wireframe boxes share `wireMat`.
      {id: "w0", geometryId: "wireBox",    position: [-6, 0, -3], scale: [1.4, 1.4, 1.4], materialId: "wireMat"},
      {id: "w1", geometryId: "wireBox",    position: [ 0, 0, -3], scale: [1.4, 1.4, 1.4], materialId: "wireMat"},
      {id: "w2", geometryId: "wireBox",    position: [ 6, 0, -3], scale: [1.4, 1.4, 1.4], materialId: "wireMat"},
    ],
    objects: [
      {id: "obj-s0", meshIds: ["s0"]},
      {id: "obj-s1", meshIds: ["s1"]},
      {id: "obj-s2", meshIds: ["s2"]},
      {id: "obj-w0", meshIds: ["w0"]},
      {id: "obj-w1", meshIds: ["w1"]},
      {id: "obj-w2", meshIds: ["w2"]},
    ],
  }));

  const surfaceMat = sceneModel.materials["surfaceMat"];
  const wireMat    = sceneModel.materials["wireMat"];
  if (!surfaceMat || !wireMat) {
    throw new Error("Failed to look up materials by id");
  }

  // ── Hatch-pattern + space pickers ──
  //
  // Two pickers cooperate to drive a single hatchPattern setter:
  //   - the style picker picks one of the named presets,
  //   - the space picker chooses screen-space or world-space.
  //
  // On any change we rebuild a `HatchParams` object: the preset's
  // line-family table from `HATCH_STYLE_PRESETS` is copied
  // verbatim for screen-space, or rescaled to world units for
  // world-space (the boxes below are 2.8 units wide; dividing
  // the pixel-unit spacings by 50 gives a comparable density at
  // the demo's default zoom). The resulting `HatchParams` is
  // assigned to `surfaceMat.hatchPattern`, whose setter
  // re-normalises into the material's internal buffer, fires
  // `onSceneMaterialPatternChanged`, and the renderer event
  // path overwrites the slot in the per-batch
  // HatchPatternTexture.
  let currentHatchStyle = "diagonalLines";
  let currentHatchSpace = "screen";

  function applyHatch() {
    const preset = xeokit.model.scene.HATCH_STYLE_PRESETS[currentHatchStyle] || [];
    if (preset.length === 0) {
      // "solid" — pass through as a HatchParams with no
      // families. Equivalent to the "solid" string, but keeps
      // the space tagging consistent with the other styles.
      surfaceMat.hatchPattern = {families: [], space: currentHatchSpace};
      return;
    }
    const scale = currentHatchSpace === "world" ? 1 / 50 : 1;
    const families = preset.map((fam) => ({
      angle:     fam.angle,
      spacing:   fam.spacing   * scale,
      lineWidth: fam.lineWidth * scale,
    }));
    surfaceMat.hatchPattern = {
      families,
      color: [0, 0, 0],
      space: currentHatchSpace,
    };
  }

  applyHatch();

  const info = studio.openInfoPanel({
    id:    "building_materials_mutablePatterns",
    title: "Mutable material patterns",
    description:
      "<p>Two rows of boxes — surface boxes (top) share one " +
      "<code>SceneMaterial</code>, wireframe boxes (bottom) share " +
      "another. Picking a preset below updates the material's " +
      "<code>hatchPattern</code> or <code>linePattern</code> at " +
      "runtime; the new texel data lands in the per-batch pattern " +
      "table on the next frame, with no model rebuild and no " +
      "mesh-side resync.</p>",
  });
  info.addRadioGroup({
    label:    "Hatch pattern",
    value:    currentHatchStyle,
    options:  [
      {value: "solid",         label: "solid"},
      {value: "lines",         label: "lines"},
      {value: "cross",         label: "cross"},
      {value: "diagonalLines", label: "diagonal"},
      {value: "diagonalCross", label: "diagonal-cross"},
    ],
    onChange: (v) => { currentHatchStyle = v; applyHatch(); },
  });
  info.addRadioGroup({
    label:    "Hatch space",
    value:    currentHatchSpace,
    options:  [
      {value: "screen", label: "Screen"},
      {value: "world",  label: "World"},
    ],
    onChange: (v) => { currentHatchSpace = v; applyHatch(); },
  });
  info.addRadioGroup({
    label:    "Line pattern",
    value:    "solid",
    options:  [
      {value: "solid",      label: "solid"},
      {value: "dashed",     label: "dashed"},
      {value: "dotted",     label: "dotted"},
      {value: "dashDot",    label: "dash-dot"},
      {value: "dashDotDot", label: "dash-dot-dot"},
    ],
    onChange: (v) => { wireMat.linePattern = v; },
  });

  studio.finished();
});


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function mustOk(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
