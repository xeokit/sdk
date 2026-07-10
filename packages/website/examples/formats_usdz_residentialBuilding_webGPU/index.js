// Loads and views the ResidentialBuilding Pixar USDZ file through WebGPU.
//
// This mirrors formats_usdz_residentialBuilding, but uses the lower-level
// Scene/Viewer/WebGPURenderer composition because Studio currently owns the
// WebGL-oriented viewing stack.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const USDZ_URL = "../../models/ResidentialBuilding/usdz/model.usdz";
const COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const status = document.getElementById("status");
const canvas = document.getElementById("demoCanvas");

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  if (!navigator.gpu) {
    reportError("This browser does not expose navigator.gpu. Use a WebGPU-enabled browser to run this example.");
    return;
  }

  const {Scene} = xeokit.model.scene;
  const {Viewer} = xeokit.viewing.viewer;
  const {ViewController: InputController} = xeokit.viewing.viewController;
  const {WebGPURenderer} = xeokit.viewing.webGPURenderer;
  const USDZLoader = xeokit.formats.usdz?.USDZLoader;

  if (!USDZLoader) {
    reportError("USDZLoader is not in the website bundle. Rebuild the bundle before running this example.");
    return;
  }

  updateStatus("Creating WebGPU device...");
  const rendererResult = await WebGPURenderer.create({
    logging: true
  });

  if (!rendererResult.ok) {
    reportError(rendererResult.error);
    return;
  }

  const renderer = rendererResult.value;
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error);
  });

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "webgpuUSDZResidentialBuildingView",
    htmlElement: canvas,
    backgroundColor: [0.97, 0.98, 0.99],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [20, 15, 20],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  }));
  let inputController = null;

  try {
    updateStatus("Loading USDZ...");
    const response = await fetch(USDZ_URL);
    if (!response.ok) {
      throw new Error(`Could not fetch ${USDZ_URL} (HTTP ${response.status})`);
    }
    const fileData = await response.arrayBuffer();

    const sceneModel = mustOk(scene.createModel({
      id: "webgpuUSDZResidentialBuilding",
      coordinateSystem: COORDINATE_SYSTEM
    }));

    await new USDZLoader().load({
      fileData,
      sceneModel
    });

    const sceneAABB = getSceneModelAABB(sceneModel);
    if (sceneAABB) {
      fitViewToAABB(view, sceneAABB);
    }

    const attachResult = renderer.attachViewer(viewer);
    if (!attachResult.ok) {
      throw new Error(attachResult.error);
    }
    inputController = createInputController(InputController, view, {
      keyboardDollyRate: 12,
      keyboardPanRate: 5,
      mouseWheelDollyRate: 90,
      touchDollyRate: 0.18
    });

    view.needsRender();

    const counts = {
      objects: Object.keys(sceneModel.objects).length,
      meshes: Object.keys(sceneModel.meshes).length,
      geometries: Object.keys(sceneModel.geometries).length
    };

    status.dataset.state = "ok";
    status.innerHTML =
      "<strong>WebGPU Renderer</strong>" +
      `<span>Loaded USDZ residential building: ${counts.objects} objects, ${counts.meshes} meshes, ${counts.geometries} geometries.</span>`;

    window.webgpuUSDZResidentialBuildingDemo = {
      scene,
      viewer,
      view,
      renderer,
      inputController,
      sceneModel
    };
  } catch (error) {
    inputController?.destroy();
    renderer.destroy();
    reportError(error instanceof Error ? error.message : String(error));
  }
}

function createInputController(InputController, view, cfg = {}) {
  return new InputController(view, {
    pick: noPick,
    followPointer: false,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    ...cfg
  });
}

function noPick() {
  return {
    ok: true,
    value: null
  };
}

function getSceneModelAABB(sceneModel) {
  const aabb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

  for (const meshId in sceneModel.meshes) {
    const mesh = sceneModel.meshes[meshId];
    const geometryAABB = mesh.geometry?.aabb;
    if (!geometryAABB) {
      continue;
    }
    expandAABBWithTransformedAABB(aabb, geometryAABB, mesh.worldMatrix || mesh.matrix);
  }

  return Number.isFinite(aabb[0]) ? aabb : null;
}

function expandAABBWithTransformedAABB(target, source, matrix) {
  const m = matrix || IDENTITY_MATRIX;
  for (let x = 0; x < 2; x++) {
    for (let y = 0; y < 2; y++) {
      for (let z = 0; z < 2; z++) {
        const px = source[x ? 3 : 0];
        const py = source[y ? 4 : 1];
        const pz = source[z ? 5 : 2];
        const tx = m[0] * px + m[4] * py + m[8] * pz + m[12];
        const ty = m[1] * px + m[5] * py + m[9] * pz + m[13];
        const tz = m[2] * px + m[6] * py + m[10] * pz + m[14];
        target[0] = Math.min(target[0], tx);
        target[1] = Math.min(target[1], ty);
        target[2] = Math.min(target[2], tz);
        target[3] = Math.max(target[3], tx);
        target[4] = Math.max(target[4], ty);
        target[5] = Math.max(target[5], tz);
      }
    }
  }
}

function fitViewToAABB(view, aabb) {
  const center = [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5
  ];
  const dx = aabb[3] - aabb[0];
  const dy = aabb[4] - aabb[1];
  const dz = aabb[5] - aabb[2];
  const radius = Math.max(Math.hypot(dx, dy, dz) * 0.65, 1);

  view.camera.look = center;
  view.camera.eye = [
    center[0] + radius,
    center[1] - radius * 1.35,
    center[2] + radius * 0.85
  ];
  view.camera.up = [0, 0, 1];
}

function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function updateStatus(message) {
  status.dataset.state = "";
  status.innerHTML = `<strong>WebGPU Renderer</strong><span>${escapeHTML(message)}</span>`;
}

function reportError(message) {
  status.dataset.state = "error";
  status.innerHTML = `<strong>WebGPU Renderer</strong><span>${escapeHTML(message)}</span>`;
  console.error("[formats_usdz_residentialBuilding_webGPU]", message);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const IDENTITY_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
];
