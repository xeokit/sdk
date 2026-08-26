import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const status = document.getElementById("status");
const canvas = document.getElementById("demoCanvas");
const marker = document.getElementById("marker");

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
  const {ModelNavigationController: InputController} = xeokit.viewing.navigation.model;
  const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;
  const {TrianglesPrimitive} = xeokit.base.constants;

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "webgpuSurfacePickView",
    htmlElement: canvas,
    backgroundColor: [0.07, 0.10, 0.18],
    camera: {
      eye: [0, 0, 4.2],
      look: [0, 0, 0],
      up: [0, 1, 0]
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

  const inputController = createInputController(InputController, view);

  mustOk(scene.createModel({
    id: "webgpuPickSurfaceModel",
    geometries: [
      {
        id: "surfacePatchGeometry",
        primitive: TrianglesPrimitive,
        positions: [
          -1.40,  0.85, 0,
          -1.15, -0.90, 0,
           0.10,  0.62, 0,
           0.45, -0.78, 0,
           1.28,  0.86, 0,
           1.45, -0.42, 0
        ],
        indices: [
          0, 1, 2,
          2, 1, 3,
          2, 3, 4,
          4, 3, 5
        ]
      }
    ],
    meshes: [
      {
        id: "pickableBlueMesh",
        geometryId: "surfacePatchGeometry",
        color: [0.18, 0.58, 0.96],
        opacity: 1
      }
    ],
    objects: [
      {
        id: "pickableSurface",
        meshIds: ["pickableBlueMesh"]
      }
    ]
  }));

  canvas.addEventListener("mousemove", (event) => {
    const canvasPos = getCanvasPos(event);
    const result = renderer.pick(view, {canvasPos});
    if (!result.ok) {
      reportError(result.error);
      return;
    }
    renderPickResult(canvasPos, result.value);
  });

  canvas.addEventListener("mouseleave", () => {
    marker.style.display = "none";
    renderReady();
  });

  renderReady();
  view.needsRender();

  window.addEventListener("resize", () => {
    view.needsRender();
  });

  window.webgpuPickSurfaceDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController
  };
}

function renderReady() {
  status.dataset.state = "ok";
  status.innerHTML =
    "<strong>WebGPU Surface Pick</strong>" +
    "<span>Move the pointer over the blue triangles to inspect the renderer pick result.</span>";
}

function renderPickResult(canvasPos, pickResult) {
  if (!pickResult) {
    marker.style.display = "none";
    status.innerHTML =
      "<strong>WebGPU Surface Pick</strong>" +
      `<span>No triangle under <code>${formatVec(canvasPos, 0)}</code>.</span>`;
    return;
  }

  marker.style.display = "block";
  marker.style.left = `${canvasPos[0]}px`;
  marker.style.top = `${canvasPos[1]}px`;
  status.innerHTML =
    "<strong>WebGPU Surface Pick</strong>" +
    `<span>Object: <code>${escapeHTML(pickResult.viewObject?.id || "none")}</code></span><br>` +
    `<span>Mesh: <code>${escapeHTML(pickResult.sceneMesh?.id || "none")}</code></span><br>` +
    `<span>Indices: <code>${formatVec(pickResult.indices, 0)}</code></span><br>` +
    `<span>Local: <code>${formatVec(pickResult.localPos, 3)}</code></span><br>` +
    `<span>World: <code>${formatVec(pickResult.worldPos, 3)}</code></span><br>` +
    `<span>View: <code>${formatVec(pickResult.viewPos, 3)}</code></span>`;
}

function createInputController(InputController, view) {
  return new InputController(view, {
    pick: noPick,
    followPointer: false,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 3,
    keyboardPanRate: 1.5,
    mouseWheelDollyRate: 20,
    touchDollyRate: 0.08
  });
}

function getCanvasPos(event) {
  const rect = canvas.getBoundingClientRect();
  return [
    event.clientX - rect.left,
    event.clientY - rect.top
  ];
}

function noPick() {
  return {
    ok: true,
    value: null
  };
}

function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function formatVec(value, digits) {
  if (!value) {
    return "none";
  }
  return Array.from(value).map((component) => Number(component).toFixed(digits)).join(", ");
}

function reportError(message) {
  status.dataset.state = "error";
  status.innerHTML = `<strong>WebGPU Surface Pick</strong><span>${escapeHTML(message)}</span>`;
  console.error("[view/webgpu/pick-surface]", message);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
