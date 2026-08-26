import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const CITYGML_URL = "../../../../models/OGC_CityBlock_LOD4/citygml/model.gml";
const COORD_SYS_URL = "../../../../models/OGC_CityBlock_LOD4/coordSys.json";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {
  const { scene, data } = studio;
  const status = document.getElementById("status");
  const coordinateSystem = await loadCoordinateSystem();
  applyCoordinateSystem(scene.coordinateSystem, coordinateSystem);
  const origin = coordinateSystem.origin;

  const view = studio.viewManager.createView({
    id: "demoView",
    camera: {
      eye: localPosition([459030, 5438330, 160], origin),
      look: localPosition([458934, 5438382, 114], origin),
      up: [0, 0, 1]
    }
  });

  const sceneModelResult = scene.createModel({
    id: "citygmlBuilding",
    coordinateSystem,
    updateHint: "static"
  });
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const dataModelResult = data.createModel({ id: "citygmlBuilding" });
  if (!dataModelResult.ok) {
    throw new Error(dataModelResult.error);
  }

  try {
    const response = await fetch(CITYGML_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading ${CITYGML_URL}`);
    }

    await new xeokit.formats.citygml.CityGMLLoader().load({
      fileData: await response.text(),
      sceneModel: sceneModelResult.value,
      dataModel: dataModelResult.value
    }, {
      localOrigin: origin
    });

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) {
      studio.viewManager.fitToAabb(view, aabb);
    }

    if (status) {
      status.style.display = "none";
    }
    studio.openInfoPanelFromMeta();
    studio.finished();
  } catch (err) {
    if (status) {
      status.textContent = `CityGML load failed: ${err.message || err}`;
    }
    console.error(err);
  }
});

function applyCoordinateSystem(target, source) {
  target.basis = source.basis;
  target.origin = source.origin;
  target.units = source.units;
  if (source.scaleToMeters !== undefined) {
    target.scaleToMeters = source.scaleToMeters;
  }
}

function localPosition(worldPosition, origin) {
  return [
    worldPosition[0] - origin[0],
    worldPosition[1] - origin[1],
    worldPosition[2] - origin[2]
  ];
}

async function loadCoordinateSystem() {
  const response = await fetch(COORD_SYS_URL, {cache: "no-cache"});
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${COORD_SYS_URL}`);
  }
  const coordinateSystem = await response.json();
  if (
    !coordinateSystem ||
    !Array.isArray(coordinateSystem.basis) ||
    !Array.isArray(coordinateSystem.origin) ||
    typeof coordinateSystem.units !== "string"
  ) {
    throw new Error(`Invalid coordSys.json at ${COORD_SYS_URL}`);
  }
  return coordinateSystem;
}
