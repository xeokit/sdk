import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const status = document.getElementById("status");
const canvas = document.getElementById("demoCanvas");

const OFFSET = 250;
const CREATE_PER_TICK = 50;
const MAX_OBJECTS = 1000;
const TICK_MS = 10;

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
  const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "webgpuStressTestView",
    htmlElement: canvas,
    backgroundColor: [1, 1, 1],
    camera: {
      projection: "perspective",
      far: 100000,
      eye: [OFFSET, -450, 300],
      look: [OFFSET, 0, 0],
      up: [0, 0, 1]
    }
  }));

  const rendererResult = await WebGPURenderer.create({
    viewer,
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

  const sceneModel = mustOk(scene.createModel({
    id: "demoModel"
  }));

  const activeObjects = [];
  let nextId = 0;
  let createdCount = 0;
  let destroyedCount = 0;

  const timer = setInterval(() => {
    for (let j = 0; j < CREATE_PER_TICK; j++) {
      const object = createObject(sceneModel, nextId++);
      if (!object) {
        continue;
      }
      activeObjects.push(object);
      createdCount++;

      if (activeObjects.length > MAX_OBJECTS) {
        destroyObject(activeObjects.shift());
        destroyedCount++;
      }
    }

    view.camera.orbitYaw(0.2);
    view.camera.orbitPitch(0.1);
    updateStatus({
      active: activeObjects.length,
      created: createdCount,
      destroyed: destroyedCount
    });
  }, TICK_MS);

  renderer.events.onRendererDestroyed.subscribe(() => {
    clearInterval(timer);
  });

  updateStatus({
    active: activeObjects.length,
    created: createdCount,
    destroyed: destroyedCount
  });

  window.webgpuSceneModelStressTestDemo = {
    scene,
    viewer,
    view,
    renderer,
    sceneModel,
    activeObjects
  };
}

function createObject(sceneModel, i) {
  const geometryId = `demoBoxGeometry${i}`;
  const meshId = `redLegMesh${i}`;
  const objectId = `redLeg${i}`;

  const geometryResult = sceneModel.createGeometry({
    id: geometryId,
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: [
      1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
      -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
      -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
    ],
    indices: [
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ]
  });

  if (!geometryResult.ok) {
    reportError(geometryResult.error);
    return null;
  }

  const meshResult = sceneModel.createMesh({
    id: meshId,
    geometryId,
    matrix: xeokit.model.scene.buildMat4({
      position: [
        OFFSET + Math.random() * 200 - 100,
        Math.random() * 200 - 100,
        Math.random() * 200 - 100
      ],
      scale: [2, 2, 2]
    }),
    color: [Math.random(), Math.random(), Math.random()]
  });

  if (!meshResult.ok) {
    geometryResult.value.destroy();
    reportError(meshResult.error);
    return null;
  }

  const objectResult = sceneModel.createObject({
    id: objectId,
    meshIds: [meshId]
  });

  if (!objectResult.ok) {
    meshResult.value.destroy();
    geometryResult.value.destroy();
    reportError(objectResult.error);
    return null;
  }

  return objectResult.value;
}

function destroyObject(sceneObject) {
  if (!sceneObject || sceneObject.destroyed) {
    return;
  }

  const meshes = sceneObject.meshes.slice();
  const geometries = meshes
    .map((mesh) => mesh.geometry)
    .filter(Boolean);

  sceneObject.destroy();

  for (const mesh of meshes) {
    if (!mesh.destroyed) {
      mesh.destroy();
    }
  }

  for (const geometry of geometries) {
    if (!geometry.destroyed) {
      geometry.destroy();
    }
  }
}

function updateStatus(stats) {
  status.dataset.state = "ok";
  status.innerHTML =
    "<strong>WebGPU Renderer</strong>" +
    `<span>Dynamic SceneModel Benchmark - active ${stats.active}, created ${stats.created}, destroyed ${stats.destroyed}</span>`;
}

function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function reportError(message) {
  status.dataset.state = "error";
  status.innerHTML = `<strong>WebGPU Renderer</strong><span>${escapeHTML(message)}</span>`;
  console.error("[benchmarks/scene/stress-test_webGPU]", message);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
