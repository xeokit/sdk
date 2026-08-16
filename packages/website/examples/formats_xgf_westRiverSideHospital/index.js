import * as xeokit from "../../js/xeokit-studio-bundle.js?v=no-interim-frames-20260815b";

const MODEL_ID = "WestRiverSideHospital";
const MODEL_BASE = `../../models/${MODEL_ID}`;
const EXAMPLE_VERSION = "no-interim-frames-20260815b";

window.__westRiverSideHospitalNoInterimFrames = EXAMPLE_VERSION;
console.info(`[formats_xgf_westRiverSideHospital] ${EXAMPLE_VERSION} loaded`);

const canvas = document.getElementById("demoCanvas");
const status = document.getElementById("status");
canvas.style.visibility = "hidden";
status.textContent = `Loading West Riverside Hospital XGF (${EXAMPLE_VERSION})...`;

const studio = new xeokit.studio.Studio({});

studio.init({logging: false}).then(async () => {
  const {scene} = studio;

  try {
    const coordinateSystem = await loadCoordinateSystem();
    const sceneModel = mustCreate(scene.createModel({
      id: MODEL_ID,
      coordinateSystem,
      updateHint: "static",
      memoryPolicy: "compact"
    }));

    const xgfBytes = await fetchArrayBuffer(`${MODEL_BASE}/xgf/model.xgf`);
    sceneModel.building = true;
    let batchActive = false;
    try {
      mustOk(sceneModel.beginBatch({id: `${MODEL_ID}:xgf`}));
      batchActive = true;
      await new xeokit.formats.xgf.XGFLoader().load({
        fileData: xgfBytes,
        sceneModel
      });
      mustOk(sceneModel.commitBatch());
      batchActive = false;
      mustOk(sceneModel.seal());
    } catch (err) {
      if (batchActive) {
        mustOk(sceneModel.rollbackBatch());
      }
      throw err;
    } finally {
      sceneModel.building = false;
    }

    const view = studio.viewManager.createView({
      camera: {
        eye: [-55, -75, 42],
        look: [0, 0, 8],
        up: [0, 0, 1]
      }
    });

    view.effects.edges.renderModes = [
      xeokit.base.constants.DetailedRender,
      xeokit.base.constants.RealisticRender
    ];
    view.effects.edges.useMeshColor = true;
    view.effects.edges.edgeWidth = 1;

    status.style.display = "none";
    const modelAABB = getSceneModelAABB(sceneModel, studio.picking.collisionIndex);
    if (modelAABB) {
      studio.viewManager.fitToAabb(view, modelAABB);
    }
    canvas.style.visibility = "visible";
    studio.finished();
  } catch (err) {
    canvas.style.visibility = "visible";
    status.textContent = `Failed to load West Riverside Hospital XGF: ${err.message || err}`;
    console.error(err);
  }
});

async function loadCoordinateSystem() {
  const response = await fetch(`${MODEL_BASE}/coordSys.json`, {cache: "no-cache"});
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${MODEL_BASE}/coordSys.json`);
  }
  const coordinateSystem = await response.json();
  if (
    !coordinateSystem ||
    !Array.isArray(coordinateSystem.basis) ||
    !Array.isArray(coordinateSystem.origin) ||
    typeof coordinateSystem.units !== "string"
  ) {
    throw new Error("Invalid WestRiverSideHospital coordSys.json");
  }
  return coordinateSystem;
}

async function fetchArrayBuffer(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${src}`);
  }
  return response.arrayBuffer();
}

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function getSceneModelAABB(sceneModel, collisionIndex) {
  let aabb = null;

  for (const objectId of Object.keys(sceneModel.objects)) {
    const objectAABB = collisionIndex.getObjectAABB(objectId);
    if (!objectAABB) {
      continue;
    }
    if (!aabb) {
      aabb = Array.from(objectAABB);
      continue;
    }
    aabb[0] = Math.min(aabb[0], objectAABB[0]);
    aabb[1] = Math.min(aabb[1], objectAABB[1]);
    aabb[2] = Math.min(aabb[2], objectAABB[2]);
    aabb[3] = Math.max(aabb[3], objectAABB[3]);
    aabb[4] = Math.max(aabb[4], objectAABB[4]);
    aabb[5] = Math.max(aabb[5], objectAABB[5]);
  }

  return aabb || collisionIndex.getSceneAABB();
}
