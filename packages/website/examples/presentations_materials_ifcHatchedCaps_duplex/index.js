// IFC Materials + Section Caps — Duplex.
//
// Loads the Duplex SceneModel + DataModel, paints each
// SceneObject with the procedural IFC material that matches its
// IFC type, then slices the model with a horizontal section
// plane. Each material's hatch convention shows on the model
// body in `DetailedRender`; the section-plane cap pass fills
// each cross-section with a plain `capColor` in both render
// modes.
//
// The view defaults to `DetailedRender` so:
//   - `view.effects.bodyHatch.applied` is true → opaque triangle
//     batches render via the un-textured Lambert variant and the
//     material's hatch overlays the body.
//   - `view.effects.sectionPlaneCaps.applied` is true → the
//     stencil cap pass fills each cap with `capColor`.
//
// Flip to `RealisticRender` to see the PBR textures on the body;
// caps stay filled in either mode.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const MODEL_BASE = "../../models/Duplex";

async function main() {

  const studio = new xeokit.studio.Studio({});
  await studio.init();

  const {scene, data} = studio;

  // ── DataModel + SceneModel populated from the Duplex assets ──
  const dataModelResult = data.createModel({id: "duplex"});
  if (!dataModelResult.ok) throw new Error(dataModelResult.error);
  const dataModel = dataModelResult.value;

  const sceneModelResult = scene.createModel({
    id: "duplex",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0,
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    },
  });
  if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
  const sceneModel = sceneModelResult.value;

  await studio.loadModel({
    id: "duplex",
    src: `${MODEL_BASE}/datamodel/model.json`,
    format: "datamodel",
    dataModel,
  });

  await studio.loadModel({
    id: "duplex",
    src: `${MODEL_BASE}/xgf/model.xgf`,
    format: "xgf",
    sceneModel,
  });

  // ── Attach procedural IFC materials in place. Reads each
  // SceneObject's IFC type from the DataModel and binds the
  // matching painter's textures + SceneMaterial (with body
  // hatch pattern) to that object's SceneMeshes.
  //
  // applyIFCMaterials is `async` — texture generation streams
  // through the progress reporter. Await the result so the
  // SDKResult check actually inspects a resolved value.
  const attachResult = await xeokit.studio.applyIFCMaterials.applyIFCMaterials({
    sceneModel,
    dataModel,
    textureSize: 256,
  });
  if (!attachResult.ok) throw new Error(attachResult.error);

  // ── View. Starts in DetailedRender — bodyHatch activates,
  // model body shows the hatched-Lambert schematic appearance.
  const view = studio.viewManager.createView({
    camera: {
      eye:  [31.387, 32.115, 14.796],
      look: [0.612, 6.667, 2.524],
      up:   [-0.226, -0.187, 0.956],
    },
    renderMode: xeokit.base.constants.DetailedRender,
    effects: {
      tonemap: {sRGBEncode: true},
      // Activate the stencil cap pass in both Detailed and
      // Realistic modes so the user can toggle between body
      // styles without losing the cross-section fill.
      sectionPlaneCaps: {
        renderModes: [
          xeokit.base.constants.DetailedRender,
          xeokit.base.constants.RealisticRender,
        ],
      },
    },
  });

  // ── Horizontal section plane. World is Z-up after the Duplex
  // coordinate-system swap (camera's `up` ≈ +Z), so the cut
  // normal is +Z and the slider moves the cut up and down along
  // Z. Default Y = 2.6 m roughly puts it at the first-floor
  // ceiling line; every IFC element gets sectioned at some point
  // across the slider's range.
  const planeResult = view.createSectionPlane({
    id: "horizontal",
    pos: [0, 0, 2.6],
    dir: [0, 0, 1],
    active: true,
    // capColor is the flat fill rendered into the cross-section
    // by the cap quad. A neutral mid-grey works for the mixed
    // steel / concrete / wood materials in this model.
    capColor: [0.55, 0.56, 0.58],
  });
  if (!planeResult.ok) throw new Error(planeResult.error);
  const sectionPlane = planeResult.value;

  // ── UI bindings ──────────────────────────────────────────────
  const planeBtn    = document.getElementById("planeToggle");
  const planeOffset = document.getElementById("planeOffset");
  const capsBtn     = document.getElementById("capsToggle");
  const modeBtn     = document.getElementById("modeToggle");

  // Section plane: slider sets the world Y of the plane; toggle
  // flips it on / off.
  function syncPlaneBtn() {
    planeBtn.textContent = sectionPlane.active ? "on" : "off";
    planeBtn.setAttribute("aria-pressed", String(sectionPlane.active));
  }
  planeBtn.addEventListener("click", () => {
    sectionPlane.active = !sectionPlane.active;
    syncPlaneBtn();
  });
  planeOffset.addEventListener("input", () => {
    const z = parseFloat(planeOffset.value);
    sectionPlane.pos = [0, 0, z];
  });
  syncPlaneBtn();

  // Caps: flip view.effects.sectionPlaneCaps.renderModes between
  // [Detailed, Realistic] (on) and [] (off). The cap pass costs
  // ~3 extra model traversals per cap-enabled plane per frame.
  let capsOn = true;
  function syncCapsBtn() {
    capsBtn.textContent = capsOn ? "on" : "off";
    capsBtn.setAttribute("aria-pressed", String(capsOn));
  }
  capsBtn.addEventListener("click", () => {
    capsOn = !capsOn;
    view.effects.sectionPlaneCaps.renderModes = capsOn
      ? [xeokit.base.constants.DetailedRender, xeokit.base.constants.RealisticRender]
      : [];
    syncCapsBtn();
  });

  // Mode: flip between Detailed (hatched body) and Realistic
  // (PBR body). Cap fill is the flat capColor in either mode.
  function syncModeBtn() {
    const detailed = view.renderMode === xeokit.base.constants.DetailedRender;
    modeBtn.textContent = detailed ? "Detailed" : "Realistic";
    modeBtn.setAttribute("aria-pressed", String(detailed));
  }
  modeBtn.addEventListener("click", () => {
    view.renderMode = (view.renderMode === xeokit.base.constants.DetailedRender)
      ? xeokit.base.constants.RealisticRender
      : xeokit.base.constants.DetailedRender;
    syncModeBtn();
  });
  syncModeBtn();

  studio.finished();
}

main().catch(err => {
  console.error("[IFCMaterials_HatchedCaps_Duplex]", err);
});
