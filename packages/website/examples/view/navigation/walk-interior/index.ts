import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WalkNavigationController} from "@xeokit/sdk/viewing/navigation/walk";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {failExample, fetchArrayBuffer, fetchJSON, finishExample, mustElement, mustOk} from "../../../utils/standaloneRuntime.js";

const MODEL_BASE = "../../../../models/OTCConferenceCenter";
const XGF_URL = `${MODEL_BASE}/xgf/model.xgf`;
const DATA_MODEL_URL = `${MODEL_BASE}/datamodel/model.json`;
const OTC_CONFERENCE_CENTER_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  origin: [0, 0, 0],
  units: "meters"
};

const INITIAL_CAMERA = {
  eye: [21.3, -31.1, 9.8],
  look: [24.8, -29.2, 9.78],
  up: [0, 0, 1]
};

const canvas = mustElement("demoCanvas");
const status = mustElement("status");

main().catch((error) => {
  failExample("[view/navigation/walk-interior]", error);
});

async function main() {
  // Scene stores the building once; the Viewer creates a camera View over that
  // shared scene. WalkNavigationController then constrains that View's camera.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const renderer = mustOk(await WebGPURenderer.create({viewer}));

  // Start inside the conference center at human eye height. The up vector
  // matches the explicit Z-up model coordinate system below.
  const view = mustOk(viewer.createView({
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
    failExample("[view/navigation/walk-interior]", error);
  });

  // Model navigation remains installed, but walk navigation will suspend it
  // while active so keyboard and pointer input drive first-person movement.
  const modelNavigation = new ModelNavigationController(view, {
    followPointer: false,
    doublePickFlyTo: false,
    keyboardDollyRate: 12,
    keyboardPanRate: 5,
    mouseWheelDollyRate: 90,
    touchDollyRate: 0.18
  });

  try {
    const dataModel = await fetchJSON(DATA_MODEL_URL);

    // The navigation filters use semantic object data to decide what can be
    // walked on and what should block movement; XGF supplies the renderable
    // geometry, while the DataModel supplies IFC-like type/name metadata.
    const navigationFilters = createWalkNavigationFilters(dataModel);
    const sceneModel = mustOk(scene.createModel({
      id: "otcConferenceCenterWalkNavigation",
      updateHint: "static",
      coordinateSystem: OTC_CONFERENCE_CENTER_COORDINATE_SYSTEM
    }));

    // Load the XGF bytes into the pre-created SceneModel so coordinate-system
    // and update-policy decisions remain visible to users of the loader.
    const xgfBytes = await fetchArrayBuffer(XGF_URL);
    const loadResult = await new XGFLoader().load({
      fileData: xgfBytes,
      sceneModel
    });
    if (loadResult && loadResult.ok === false) {
      throw new Error(loadResult.error);
    }

    // Walk navigation casts against the loaded scene. The semantic filters keep
    // walls and columns solid while allowing floor/slab-like objects as ground.
    const walkNavigationController = new WalkNavigationController(view, {
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
    finishExample(renderer, view);
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
    });
  } catch (err) {
    failExample("[view/navigation/walk-interior]", err);
  }
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
