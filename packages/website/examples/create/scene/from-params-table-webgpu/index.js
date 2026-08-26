import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

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
  const {ModelNavigationController: InputController} = xeokit.viewing.navigation.model;
  const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "webgpuFromParamsTableView",
    htmlElement: canvas,
    backgroundColor: [0.97, 0.98, 0.99],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [14, 14, 10],
      look: [0, 0, 3],
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
  const inputController = createInputController(InputController, view, {
    keyboardDollyRate: 10,
    keyboardPanRate: 4,
    mouseWheelDollyRate: 70,
    touchDollyRate: 0.16
  });
  renderer.events.onViewRendered.subscribe(() => {
    status.dataset.state = "ok";
    status.innerHTML =
      "<strong>WebGPU Renderer</strong>" +
      "<span>Rendering a table-shaped SceneModel populated with SceneModel.fromParams().</span>";
  });

  const sceneModel = mustOk(scene.createModel({
    id: "webgpuTableModel"
  }));

  mustOk(sceneModel.fromParams(createTableModelParams()));

  view.needsRender();

  window.addEventListener("resize", () => {
    view.needsRender();
  });

  window.webgpuFromParamsTableDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController,
    sceneModel
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

function createTableModelParams() {
  const {TrianglesPrimitive} = xeokit.base.constants;

  return {
    geometries: [
      {
        id: "demoBoxGeometry",
        primitive: TrianglesPrimitive,
        positions: [
          1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
          -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
          -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
        ],
        uvs: [
          1, 0, 0, 0, 0, 1, 1, 1,
          0, 0, 0, 1, 1, 1, 1, 0,
          1, 1, 1, 0, 0, 0, 0, 1,
          1, 0, 0, 0, 0, 1, 1, 1,
          0, 1, 1, 1, 1, 0, 0, 0,
          0, 1, 1, 1, 1, 0, 0, 0
        ],
        indices: [
          0, 1, 2, 0, 2, 3,
          4, 5, 6, 4, 6, 7,
          8, 9, 10, 8, 10, 11,
          12, 13, 14, 12, 14, 15,
          16, 17, 18, 16, 18, 19,
          20, 21, 22, 20, 22, 23
        ],
        edgeIndices: [
          0, 1, 1, 2, 2, 3, 3, 0,
          9, 10, 10, 14, 14, 17, 17, 9,
          0, 9, 1, 10, 2, 14, 3, 17
        ]
      }
    ],
    meshes: [
      {
        id: "redLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [-4, -4, 3],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [1, 0.3, 0.3]
      },
      {
        id: "greenLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [4, -4, 3],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [0.3, 1.0, 0.3]
      },
      {
        id: "blueLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [4, 4, 3],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [0.3, 0.3, 1.0]
      },
      {
        id: "yellowLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [-4, 4, 3],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [1.0, 1.0, 0.0]
      },
      {
        id: "tableTop-mesh",
        geometryId: "demoBoxGeometry",
        position: [0, 0, 6],
        scale: [6, 6, 0.5],
        rotation: [0, 0, 0],
        color: [1.0, 0.3, 1.0]
      }
    ],
    objects: [
      {
        id: "redLeg",
        meshIds: ["redLeg-mesh"]
      },
      {
        id: "greenLeg",
        meshIds: ["greenLeg-mesh"]
      },
      {
        id: "blueLeg",
        meshIds: ["blueLeg-mesh"]
      },
      {
        id: "yellowLeg",
        meshIds: ["yellowLeg-mesh"]
      },
      {
        id: "purpleTableTop",
        meshIds: ["tableTop-mesh"]
      }
    ]
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
  console.error("[create/scene/from-params-table_webGPU]", message);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
