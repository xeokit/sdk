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

import {LinesPrimitive, TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {buildBoxLines} from "@xeokit/sdk/model/generation/buildGeometry";
import {HATCH_STYLE_PRESETS} from "@xeokit/sdk/model/scene";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {createExampleRenderer, createModelNavigationPickAdapter} from "../../../utils/standaloneRuntime.js";
import {signalExampleLoaded, signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

const canvas = mustElement<HTMLCanvasElement>("demoCanvas");
const controls = mustElement<HTMLElement>("controls");
const status = document.getElementById("status");

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});

  const view = mustCreate(viewer.createView({
    id: "mutablePatternsView",
    htmlElement: canvas,
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      eye:  [0,  -22, 6],
      look: [0,   0,  0],
      up:   [0,   0,  1],
    },
    effects: {
      edges: {enabled: false},
      bloom: {enabled: false},
      sao: {enabled: false},
      shadows: {enabled: false},
      sky: {
        enabled: true,
        skyColor: [0.60, 0.70, 0.84],
        horizonColor: [0.78, 0.82, 0.86],
        groundColor: [0.58, 0.62, 0.58],
        sunEnabled: true,
        sunDirection: [0.45, 0.35, 0.85],
        worldUp: [0, 0, 1]
      }
    }
  }));

  const renderer = await createExampleRenderer(viewer, {logging: true});
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error);
  });
  mustCreate(renderer.setInfiniteGridEnabled(true));
  const picker = new RoutingPickStrategy(scene, renderer);
  new ModelNavigationController(view, {
    pick: createModelNavigationPickAdapter(view, picker),
    followPointer: true,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 10,
    keyboardPanRate: 4,
    mouseWheelDollyRate: 70,
    touchDollyRate: 0.16
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
  const boxLines = mustOk(buildBoxLines({
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
        primitive: TrianglesPrimitive,
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
        primitive: LinesPrimitive,
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
    const preset = HATCH_STYLE_PRESETS[currentHatchStyle] || [];
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

  addRadioGroup("Hatch pattern", currentHatchStyle, [
    {value: "solid",         label: "solid"},
    {value: "lines",         label: "lines"},
    {value: "cross",         label: "cross"},
    {value: "diagonalLines", label: "diagonal"},
    {value: "diagonalCross", label: "diagonal-cross"},
  ], (value) => { currentHatchStyle = value; applyHatch(); });
  addRadioGroup("Hatch space", currentHatchSpace, [
    {value: "screen", label: "Screen"},
    {value: "world",  label: "World"},
  ], (value) => { currentHatchSpace = value; applyHatch(); });
  addRadioGroup("Line pattern", "solid", [
    {value: "solid",      label: "solid"},
    {value: "dashed",     label: "dashed"},
    {value: "dotted",     label: "dotted"},
    {value: "dashDot",    label: "dash-dot"},
    {value: "dashDotDot", label: "dash-dot-dot"},
  ], (value) => { wireMat.linePattern = value; });

  renderer.events.onViewRendered.subscribe(() => {
    if (status) {
      status.dataset.state = "ok";
      status.textContent = "Mutable material patterns with sky and grid";
    }
  });

  signalExampleLoadedOnNextRender(renderer, view);

  window.addEventListener("resize", () => {
  });

  (window as any).mutablePatternsDemo = {
    scene,
    viewer,
    view,
    renderer,
    sceneModel
  };
}


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function mustOk(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function addRadioGroup(
  label: string,
  value: string,
  options: {value: string; label: string}[],
  onChange: (value: string) => void
) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = label;
  fieldset.appendChild(legend);
  for (const option of options) {
    const optionId = `${label}-${option.value}`.replace(/\W+/g, "-");
    const row = document.createElement("label");
    row.htmlFor = optionId;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = label;
    input.id = optionId;
    input.value = option.value;
    input.checked = option.value === value;
    input.addEventListener("change", () => {
      if (input.checked) {
        onChange(input.value);
      }
    });
    row.append(input, document.createTextNode(option.label));
    fieldset.appendChild(row);
  }
  controls.appendChild(fieldset);
}

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

function reportError(message: string) {
  if (status) {
    status.dataset.state = "error";
    status.textContent = message;
  }
  signalExampleLoaded();
  console.error("[create/materials/mutable-patterns]", message);
}
