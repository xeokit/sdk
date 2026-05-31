// Two-view viewer for the elevations dataset.
//
//   View 1 ("buildingView") — 3D perspective view of the building,
//      from XGF + DataModel JSON under dataset/model/.
//
//   View 2 ("planView") — top-down 2D plan view of the Level 1
//      floor plan, loaded as vector geometry from the PDF under
//      dataset/elevations/.
//
// The building and the plan live in separate SceneModels and are
// hidden from each other's View via per-ViewObject visibility, so
// each view shows only the geometry that's relevant to it.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({ maxViews: 2 });

studio.init().then(async () => {

  const { scene, data } = studio;

  // ── Views ────────────────────────────────────────────────────────
  //
  // Building view is Z-up. Plan view is top-down with world +Y as
  // screen-up — matches the convention the PDFLoader emits the
  // floor plan into (scene XY at z=0).
  const buildingView = studio.viewManager.createView({
    id: "buildingView",
    camera: {
      eye:  [20, -20, 20],
      look: [ 0,   0,  0],
      up:   [ 0,   0,  1],
    },
  });

  const planView = studio.viewManager.createView({
    id: "planView",
    camera: {
      projection: "perspective",
      eye:  [0, 0, 50],
      look: [0, 0,  0],
      up:   [0, 1,  0],
    },
  });

  // ── Building SceneModel + DataModel ──────────────────────────────
  const sceneModelResult = scene.createModel({
    id: "elevations",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    },
  });
  if (!sceneModelResult.ok) {
    throw new Error("createModel: " + sceneModelResult.error);
  }
  const sceneModel = sceneModelResult.value;

  const dataModelResult = data.createModel({ id: "elevations" });
  if (!dataModelResult.ok) {
    throw new Error("createDataModel: " + dataModelResult.error);
  }
  const dataModel = dataModelResult.value;

  // ── Plan SceneModel ──────────────────────────────────────────────
  //
  // Default coordinate system (Z-up, metres). The PDFLoader is given
  // `scale: 0.001` below to convert PDF user-space millimetres into
  // scene metres, so the plan footprint lands in scene-metre XY at
  // z = 0.
  const planModelResult = scene.createModel({ id: "elevationsPlan" });
  if (!planModelResult.ok) {
    throw new Error("createPlanModel: " + planModelResult.error);
  }
  const planModel = planModelResult.value;

  try {
    // Building: DataModel first (semantics), then XGF (geometry).
    await studio.loadModel({
      id: "elevations",
      src: "./dataset/model/model.datamodel.json",
      format: "datamodel",
      dataModel,
    });
    await studio.loadModel({
      id: "elevations",
      src: "./dataset/model/model.xgf",
      format: "xgf",
      sceneModel,
    });

    // Plan: PDFLoader reads vector paths + fills + text out of the
    // PDF and turns them into SceneMeshes / SceneObjects in
    // `planModel`. `scale: 0.001` converts the PDF's mm to scene m.
    const pdfFileData = await fetch("./dataset/elevations/floor_plan_level_1.pdf")
      .then(r => r.arrayBuffer());
    const pdfLoader = new xeokit.formats.pdf.PDFLoader();
    const pdfResult = await pdfLoader.load(
      { fileData: pdfFileData, sceneModel: planModel },
      {
        scale:          0.001,
        bezierSteps:    16,
        lineWidthScale: 0.6,
        minLineWidth:   1.0,
        renderFills:    true,
        renderText:     true,
        textPxPerUnit:  6,
        // Inside-out 3D box per page so clicks in the empty
        // regions of the plan resolve to a pick instead of
        // missing into the background.
        backingBox:     true,
      },
    );
    if (pdfResult.ok === false) {
      throw new Error("PDF load: " + pdfResult.error);
    }

    // ── Per-view visibility ───────────────────────────────────────
    //
    // Each ViewObject lives in both Views by default. Hide the
    // building in the plan view and the plan in the building view
    // so each pane shows only what it's meant to.
    const buildingIds = Object.keys(sceneModel.objects);
    const planIds     = Object.keys(planModel.objects);
    buildingView.setObjectsVisible(planIds, false);
    planView.setObjectsVisible(buildingIds, false);

    // ── Camera framing ────────────────────────────────────────────
    //
    // Frame each view to the AABB of just the geometry it shows,
    // not the combined scene AABB. `getCombinedObjectAABB` takes
    // an explicit id list, so we use one call per SceneModel.
    const buildingAabb = studio.picking.collisionIndex.getCombinedObjectAABB(buildingIds);
    const planAabb     = studio.picking.collisionIndex.getCombinedObjectAABB(planIds);
    studio.viewManager.fitToAabb(buildingView, buildingAabb);
    studio.viewManager.fitToAabb(planView,     planAabb);

    studio.openInfoPanelFromMeta();
    studio.finished();
  } catch (e) {
    console.error("[elevations]", e);
  }
});
