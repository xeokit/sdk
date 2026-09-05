import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

const MODEL_BASE = "../../../../../models/Duplex";

const IFC4_SCHEMA = /** @type {import("@xeokit/sdk/dataModelInspector").DataFormatSchema} */ ({
  id: "IFC4",
  description: "ISO 16739-1:2018 / buildingSMART IFC4 curated subset",
  objectTypes: {
    IfcObjectDefinition: {label: "IFC Object Definition"},
    IfcContext: {superType: "IfcObjectDefinition", label: "IFC Context"},
    IfcProject: {superType: "IfcContext", label: "Project"},
    IfcSpatialStructureElement: {superType: "IfcObjectDefinition", label: "Spatial Structure Element"},
    IfcSite: {superType: "IfcSpatialStructureElement", label: "Site"},
    IfcBuilding: {superType: "IfcSpatialStructureElement", label: "Building"},
    IfcBuildingStorey: {superType: "IfcSpatialStructureElement", label: "Building Storey"},
    IfcSpace: {superType: "IfcSpatialStructureElement", label: "Space"},
    IfcElement: {superType: "IfcObjectDefinition", label: "Element"},
    IfcBuildingElement: {superType: "IfcElement", label: "Building Element"},
    IfcWall: {superType: "IfcBuildingElement", label: "Wall"},
    IfcWallStandardCase: {superType: "IfcWall", label: "Wall (Standard Case)"},
    IfcWindow: {superType: "IfcBuildingElement", label: "Window"},
    IfcDoor: {superType: "IfcBuildingElement", label: "Door"},
    IfcSlab: {superType: "IfcBuildingElement", label: "Slab"},
    IfcBeam: {superType: "IfcBuildingElement", label: "Beam"},
    IfcRoof: {superType: "IfcBuildingElement", label: "Roof"},
    IfcFooting: {superType: "IfcBuildingElement", label: "Footing"},
    IfcStair: {superType: "IfcBuildingElement", label: "Stair"},
    IfcRailing: {superType: "IfcBuildingElement", label: "Railing"},
    IfcMember: {superType: "IfcBuildingElement", label: "Member"},
    IfcStairFlight: {superType: "IfcBuildingElement", label: "Stair Flight"},
    IfcCovering: {superType: "IfcBuildingElement", label: "Covering"},
    IfcFurnishingElement: {superType: "IfcElement", label: "Furnishing Element"}
  },
  relationshipTypes: {
    IfcRelAggregates: {
      label: "Aggregates / decomposes a parent into parts",
      allowedRelatingTypes: ["IfcObjectDefinition"],
      allowedRelatedTypes: ["IfcObjectDefinition"]
    }
  }
});

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

async function loadCoordinateSystem() {
  const response = await fetch(`${MODEL_BASE}/coordSys.json`, {cache: "no-cache"});
  if (!response.ok) {
    throw new Error(`Failed to load Duplex coordinate system: ${response.status}`);
  }
  return response.json();
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
      eye: [-3.23, -3.49, 2.58],
      look: [-0.03, 0.05, 0.5],
      up: [0.26, 0.29, 0.91]
    }
  });

  view.effects.edges.enabled = true;
  view.effects.edges.useMeshColor = true;
  view.effects.edges.edgeWidth = 2;

  try {
    status.textContent = "Loading Duplex...";

    const sceneModel = mustCreate(scene.createModel({
      id: "demoModel",
      coordinateSystem: await loadCoordinateSystem()
    }));
    const dataModel = mustCreate(data.createModel({id: "demoModel"}));

    await studio.loadModel({
      id: "demoModel",
      src: `${MODEL_BASE}/datamodel/model.json`,
      format: "datamodel",
      dataModel
    });

    await studio.loadModel({
      id: "demoModel",
      src: `${MODEL_BASE}/xgf/model.xgf`,
      format: "xgf",
      sceneModel
    });

    const modelAABB = getSceneModelAABB(sceneModel, studio.picking.collisionIndex);
    const frameAABB = modelAABB || studio.picking.collisionIndex.getSceneAABB();
    if (frameAABB) {
      studio.viewManager.fitToAabb(view, frameAABB);
    }

    try {
      window.localStorage.removeItem("xkt-dh-panel");
    } catch {
      // Ignore private browsing / disabled-storage failures.
    }

    status.style.display = "none";
    studio.panels.open("dataHealth", {
      focusDataModel: dataModel,
      schema: IFC4_SCHEMA,
      initialTop: 60,
      initialRight: 17
    });
    studio.finished();
  } catch (err) {
    status.textContent = `Failed to load Duplex: ${err.message || err}`;
    console.error(err);
  }
});
