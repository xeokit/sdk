import * as xeokit from "../../js/xeokit-studio-bundle.js";

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
  const {TrianglesPrimitive} = xeokit.base.constants;

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "webgpuTriangleView",
    htmlElement: canvas,
    backgroundColor: [0.07, 0.10, 0.16],
    camera: {
      eye: [0, 0, 4],
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
  const inputController = createInputController(InputController, view, {
    keyboardDollyRate: 3,
    keyboardPanRate: 1.5,
    mouseWheelDollyRate: 20,
    touchDollyRate: 0.08
  });
  renderer.events.onViewRendered.subscribe(() => {
    status.dataset.state = "ok";
    status.innerHTML =
      "<strong>WebGPU Renderer</strong>" +
      "<span>Rendering indexed triangle meshes with flat mesh color and depth buffering.</span>";
  });

  mustOk(scene.createModel({
    id: "webgpuDepthDemo",
    geometries: [
      {
        id: "triangleA",
        primitive: TrianglesPrimitive,
        positions: [
          -0.85,  0.70, -0.25,
          -1.45, -0.75, -0.25,
           0.50, -0.55, -0.25
        ],
        indices: [0, 1, 2]
      },
      {
        id: "triangleB",
        primitive: TrianglesPrimitive,
        positions: [
          -0.25,  0.95, 0.30,
           1.35,  0.35, 0.30,
           0.15, -1.00, 0.30
        ],
        indices: [0, 1, 2]
      }
    ],
    meshes: [
      {
        id: "blueBackTriangle",
        geometryId: "triangleA",
        color: [0.20, 0.56, 1.00],
        opacity: 1
      },
      {
        id: "yellowFrontTriangle",
        geometryId: "triangleB",
        color: [1.00, 0.78, 0.22],
        opacity: 1
      }
    ],
    objects: [
      {
        id: "blueBackObject",
        meshIds: ["blueBackTriangle"]
      },
      {
        id: "yellowFrontObject",
        meshIds: ["yellowFrontTriangle"]
      }
    ]
  }));

  view.needsRender();

  window.addEventListener("resize", () => {
    view.needsRender();
  });

  window.webgpuTriangleDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController
  };
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

function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function reportError(message) {
  status.dataset.state = "error";
  status.innerHTML = `<strong>WebGPU Renderer</strong><span>${escapeHTML(message)}</span>`;
  console.error("[viewing_webGPU_triangle]", message);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
