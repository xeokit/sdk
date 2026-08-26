import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const GLB_URL = "../../../../models/BigSquareCommercialBuilding/gltf/model.glb";
const MODEL_ATTRIBUTION_URL = "https://sketchfab.com/3d-models/big-square-commercial-building-55ef437c8518489c8a35c5de2380e6b6";
const INITIAL_CAMERA = {
  eye: [20, 15, 14],
  look: [0, 0, 0],
  up: [0, 0, 1]
};
const INFO_DESCRIPTION = `
  <p>Loads a big square commercial building model from a self-contained glTF binary.</p>
  <p>Model by <a href="${MODEL_ATTRIBUTION_URL}" target="_blank" rel="noopener">VertaScan on Sketchfab</a>, licensed under CC BY 4.0.</p>
`;

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {
  const {scene} = studio;

  const view = studio.viewManager.createView({
    adaptiveQuality: false,
    backgroundColor: [0.85, 0.89, 0.93],
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
        enabled: false
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
        intensity: 0.58,
        maxOpacity: 0.5,
        affectSky: false
      },
      depthOfField: {
        enabled: true,
        focusDistance: getCameraFocusDistance(INITIAL_CAMERA),
        focalRange: 4,
        radius: 6,
        intensity: 0.42,
        nearBlur: 0.08,
        farBlur: 1.0
      }
    }
  });
  const viewRecord = studio.viewManager.views[view.id];
  viewRecord.walkNavigationController = new xeokit.viewing.navigation.walk.WalkNavigationController(view, {
    active: false,
    suspendModelNavigationController: viewRecord.modelNavigation,
    eyeHeight: 1.65,
    walkSpeed: 4.0,
    runSpeed: 8.5
  });
  bindDepthOfFieldFocus(studio, view);

  const status = document.getElementById("status");
  const setStatus = (text) => {
    if (status) {
      status.textContent = text;
    }
  };

  try {
    setStatus("Loading glTF...");
    const response = await fetch(GLB_URL);
    if (!response.ok) {
      throw new Error(`Could not fetch ${GLB_URL} (HTTP ${response.status})`);
    }

    const sceneModel = mustCreate(scene.createModel({
      id: "BigSquareCommercialBuilding",
      coordinateSystem: {
        basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        origin: [0, 0, 0],
        units: "meters",
        scaleToMeters: 1
      }
    }));

    const fileData = await response.arrayBuffer();
    await new xeokit.formats.gltf.GLTFLoader().load({fileData, sceneModel});

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) {
      studio.viewManager.fitToAabb(view, aabb);
      updateDepthOfFieldFocus(view);
    }

    if (status) {
      status.style.display = "none";
    }
    studio.openInfoPanelFromMeta({
      description: INFO_DESCRIPTION
    });
    studio.finished();
  } catch (error) {
    setStatus(`Failed to load glTF: ${error.message || error}`);
    console.error(error);
  }
});

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function bindDepthOfFieldFocus(studio, view) {
  const onCamera = (target) => {
    if (target === view || target === view.camera) {
      updateDepthOfFieldFocus(view);
    }
  };
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

function updateDepthOfFieldFocus(view) {
  view.effects.depthOfField.focusDistance = getCameraFocusDistance(view.camera);
}

function getCameraFocusDistance(camera) {
  const dx = camera.eye[0] - camera.look[0];
  const dy = camera.eye[1] - camera.look[1];
  const dz = camera.eye[2] - camera.look[2];
  return Math.max(1, Math.hypot(dx, dy, dz));
}
