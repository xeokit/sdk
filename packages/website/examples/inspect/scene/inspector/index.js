import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

async function loadCoordinateSystemFromFile(modelId) {
  const coordSysPath = `../../../../models/${encodeURIComponent(modelId)}/coordSys.json`;
  const response = await fetch(coordSysPath, {cache: "no-cache"});

  if (!response.ok) {
    throw new Error(`Failed to load coordSys.json at ${coordSysPath}`);
  }

  const json = await response.json();
  if (
    !json ||
    !Array.isArray(json.basis) ||
    !Array.isArray(json.origin) ||
    typeof json.units !== "string"
  ) {
    throw new Error(`Invalid coordSys.json at ${coordSysPath}`);
  }

  return json;
}

function mustCreate(result) {
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
    } else {
      aabb[0] = Math.min(aabb[0], objectAABB[0]);
      aabb[1] = Math.min(aabb[1], objectAABB[1]);
      aabb[2] = Math.min(aabb[2], objectAABB[2]);
      aabb[3] = Math.max(aabb[3], objectAABB[3]);
      aabb[4] = Math.max(aabb[4], objectAABB[4]);
      aabb[5] = Math.max(aabb[5], objectAABB[5]);
    }
  }

  return aabb;
}

const studio = new xeokit.studio.Studio({});

studio.init({logging: false}).then(async () => {
  const {scene, data} = studio;
  const status = document.getElementById("status");

  const view = studio.viewManager.createView({
    camera: {
      eye:  [-3.23, -3.49, 2.58],
      look: [-0.03,  0.05, 0.5],
      up:   [ 0.26,  0.29, 0.91]
    }
  });

  view.effects.edges.enabled = true;
  view.effects.edges.useMeshColor = true;
  view.effects.edges.edgeWidth = 2;

  const params = new URLSearchParams(window.location.search);
  const modelId = params.get("modelId") || "Duplex";
  const formats = (params.get("format") || "xgf")
    .split(",")
    .map(format => format.trim())
    .filter(Boolean);

  status.textContent = `Loading ${modelId} (${formats.join(", ")})...`;

  try {
    const coordinateSystem = await loadCoordinateSystemFromFile(modelId);
    const sceneModel = mustCreate(scene.createModel({
      id: "demoModel",
      coordinateSystem
    }));
    const dataModel = mustCreate(data.createModel({id: "demoModel"}));

    for (const format of formats) {
      await studio.loadModel(
        {modelId, format, sceneModel, dataModel},
        {}
      );
    }

    status.style.display = "none";
    const modelAABB = getSceneModelAABB(sceneModel, studio.picking.collisionIndex);
    const frameAABB = modelAABB || studio.picking.collisionIndex.getSceneAABB();
    if (frameAABB) {
      studio.viewManager.fitToAabb(view, frameAABB);
    }

    try {
      window.localStorage.removeItem("xkt-sh-panel");
    } catch {
      // Ignore private browsing / disabled-storage failures.
    }

    studio.panels.open("sceneHealth", {
      focusSceneModel: sceneModel,
      initialTop: 60,
      initialRight: 17
    });
    studio.finished();
  } catch (err) {
    status.textContent = `Failed to load ${modelId} (${formats.join(", ")}): ${err.message || err}`;
    console.error(err);
  }
});
