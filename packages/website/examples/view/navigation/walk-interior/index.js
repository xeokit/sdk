import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
import {signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

const MODEL_BASE = "../../../../models/OTCConferenceCenter";
const XGF_URL = `${MODEL_BASE}/xgf/model.xgf`;
const COORD_SYS_URL = `${MODEL_BASE}/coordSys.json`;
const DATA_MODEL_URL = `${MODEL_BASE}/datamodel/model.json`;

const INITIAL_CAMERA = {
  eye: [21.3, -31.1, 9.8],
  look: [24.8, -29.2, 9.78],
  up: [0, 0, 1]
};

const canvas = document.getElementById("demoCanvas");
const status = document.getElementById("status");

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  const {Scene} = xeokit.model.scene;
  const {Viewer} = xeokit.viewing.viewer;
  const {WebGLRenderer} = xeokit.viewing.renderers.webGL;
  const {ModelNavigationController} = xeokit.viewing.navigation.model;

  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const renderer = new WebGLRenderer({viewer});

  const view = mustCreate(viewer.createView({
    id: "navigationWalkInteriorView",
    htmlElement: canvas,
    adaptiveQuality: false,
    backgroundColor: [0.80, 0.84, 0.88],
    camera: {
      eye: INITIAL_CAMERA.eye,
      look: INITIAL_CAMERA.look,
      up: INITIAL_CAMERA.up,
      perspectiveProjection: {
        near: 0.01,
        far: 10000
      }
    },
    effects: {
      edges: {
        enabled: true,
        useMeshColor: true,
        edgeWidth: 1.0
      },
      tonemap: {
        enabled: true,
        mode: "aces",
        exposure: 0.35,
        sRGBEncode: true
      },
      atmosphere: {
        enabled: true,
        color: [0.86, 0.93, 1.0],
        startDistance: 10,
        endDistance: 75,
        intensity: 0.35,
        maxOpacity: 0.35,
        affectSky: false
      }
    }
  }));
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error || error.message || String(error));
  });
  const modelNavigation = new ModelNavigationController(view, {
    followPointer: false,
    doublePickFlyTo: false,
    keyboardDollyRate: 12,
    keyboardPanRate: 5,
    mouseWheelDollyRate: 90,
    touchDollyRate: 0.18
  });

  try {
    const [coordinateSystem, dataModel] = await Promise.all([
      fetchJSON(COORD_SYS_URL),
      fetchJSON(DATA_MODEL_URL)
    ]);
    const navigationFilters = createWalkNavigationFilters(dataModel);
    const sceneModel = mustCreate(scene.createModel({
      id: "otcConferenceCenterWalkNavigation",
      updateHint: "static",
      coordinateSystem
    }));

    const xgfBytes = await fetchArrayBuffer(XGF_URL);
    const loadResult = await new xeokit.formats.xgf.XGFLoader().load({
      fileData: xgfBytes,
      sceneModel
    });
    if (loadResult && loadResult.ok === false) {
      throw new Error(loadResult.error);
    }

    const walkNavigationController = new xeokit.viewing.navigation.walk.WalkNavigationController(view, {
      active: true,
      suspendModelNavigationController: modelNavigation,
      eyeHeight: 1.65,
      bodyRadius: 0.32,
      walkSpeed: 4.0,
      runSpeed: 8.5,
      stepHeight: 0.35,
      maxFall: 1.0,
      keyboardEnabledOnlyOnMouseover: false,
      obstacleFilter: navigationFilters.obstacleFilter,
      walkSurfaceFilter: navigationFilters.walkSurfaceFilter
    });

    status.style.display = "none";
    view.needsRender();
    signalExampleLoadedOnNextRender(renderer, view);
    window.navigationWalkInterior = {
      scene,
      viewer,
      view,
      renderer,
      modelNavigation,
      walkNavigationController,
      sceneModel
    };
    window.addEventListener("resize", () => {
      view.needsRender();
    });
  } catch (err) {
    reportError(err instanceof Error ? err.message : String(err));
  }
}

async function fetchArrayBuffer(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${src}`);
  }
  return response.arrayBuffer();
}

async function fetchJSON(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${src}`);
  }
  return response.json();
}

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function reportError(message) {
  status.style.display = "";
  status.textContent = `Failed to load OTC Conference Center walk navigation demo: ${message}`;
  console.error("[view/navigation/walk-interior]", message);
}

function createWalkNavigationFilters(dataModel) {
  const metadataByObjectId = new Map();
  for (const object of dataModel.objects || []) {
    if (object && object.id) {
      metadataByObjectId.set(object.id, {
        type: object.type || "",
        name: object.name || ""
      });
    }
  }

  const metadataFor = (objectId) => metadataByObjectId.get(objectId) || {type: "", name: ""};
  const isWall = ({type, name}) => {
    return type === "IfcWall"
      || type === "IfcWallStandardCase"
      || type === "IfcCurtainWall"
      || type === "IfcColumn"
      || name.startsWith("Basic Wall:");
  };
  const isFloor = ({type, name}) => {
    return (type === "IfcSlab" || type === "IfcCovering" || type === "IfcRoof")
      && (name.startsWith("Floor:")
        || name.startsWith("Roof:")
        || name.startsWith("Basic Roof:")
        || name.includes("Upper Floors")
        || name.includes("Level Plaza")
        || name.includes("Slab on Grade")
        || name.includes("Carpet on Concrete"));
  };
  const isStair = ({type, name}) => {
    return type === "IfcStair"
      || type === "IfcStairFlight"
      || name.startsWith("Stair:");
  };

  return {
    obstacleFilter: (objectId) => {
      const metadata = metadataFor(objectId);
      return isWall(metadata) || isStair(metadata);
    },
    walkSurfaceFilter: (objectId) => {
      const metadata = metadataFor(objectId);
      return isFloor(metadata) || isStair(metadata);
    }
  };
}
