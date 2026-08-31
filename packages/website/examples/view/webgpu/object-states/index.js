import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const status = document.getElementById("status");
const panel = document.getElementById("panel");
const canvas = document.getElementById("demoCanvas");
const selectedToggle = document.getElementById("selectedToggle");
const highlightedToggle = document.getElementById("highlightedToggle");
const xrayedToggle = document.getElementById("xrayedToggle");
const colorizeToggle = document.getElementById("colorizeToggle");
const opacitySlider = document.getElementById("opacitySlider");
const opacityValue = document.getElementById("opacityValue");
const visibleToggle = document.getElementById("visibleToggle");

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
    id: "webgpuObjectStatesView",
    htmlElement: canvas,
    backgroundColor: [0.06, 0.10, 0.13],
    styleBins: [
      {
        id: "selected",
        priority: 300,
        fill: true,
        fillColor: [0.1, 0.7, 1.0],
        fillAlpha: 0.4,
        edges: true
      },
      {
        id: "highlighted",
        priority: 200,
        fill: true,
        fillColor: [1.0, 0.78, 0.25],
        fillAlpha: 0.4,
        edges: true
      },
      {
        id: "xrayed",
        priority: 100,
        fill: true,
        fillColor: [0.85, 0.9, 1.0],
        fillAlpha: 0.35,
        edges: true
      }
    ],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [14, -14, 10],
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
  if (!renderer.rendering) {
    if (renderer.viewer === viewer) {
      renderer.detachViewer();
    }
    const attachResult = renderer.attachViewer(viewer);
    if (!attachResult.ok) {
      reportError(attachResult.error);
      return;
    }
    if (!renderer.rendering) {
      reportError("WebGPU renderer is attached to the Viewer, but has no active ViewManager.");
      return;
    }
  }
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error);
  });

  const inputController = new InputController(view, {
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

  mustOk(scene.createModel(createTableModelParams(TrianglesPrimitive)));

  const update = () => {
    const tableTop = view.objects.purpleTableTop;
    const greenLeg = view.objects.greenLeg;
    const blueLeg = view.objects.blueLeg;
    const redLeg = view.objects.redLeg;
    const yellowLeg = view.objects.yellowLeg;

    if (tableTop) {
      tableTop.setStyleBin("selected", selectedToggle.checked);
    }
    if (greenLeg) {
      greenLeg.setStyleBin("highlighted", highlightedToggle.checked);
    }
    if (blueLeg) {
      blueLeg.setStyleBin("xrayed", xrayedToggle.checked);
    }
    if (redLeg) {
      redLeg.colorize = colorizeToggle.checked ? [0.95, 0.18, 0.12] : null;
    }
    if (yellowLeg) {
      yellowLeg.opacity = Number(opacitySlider.value);
      yellowLeg.visible = visibleToggle.checked;
    }
    renderStatus(view);
  };

  for (const control of [selectedToggle, highlightedToggle, xrayedToggle, colorizeToggle, visibleToggle]) {
    control.addEventListener("change", update);
  }
  opacitySlider.addEventListener("input", update);

  update();
  view.needsRender();

  window.addEventListener("resize", () => {
    view.needsRender();
  });

  window.webgpuObjectStatesDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController
  };
}

function renderStatus(view) {
  panel.dataset.state = "ok";
  opacityValue.textContent = Number(opacitySlider.value).toFixed(2);
  const states = [
    ["top", view.objects.purpleTableTop?.hasStyleBin("selected") ? "selected" : "normal"],
    ["green", view.objects.greenLeg?.hasStyleBin("highlighted") ? "highlighted" : "normal"],
    ["blue", view.objects.blueLeg?.hasStyleBin("xrayed") ? "xrayed" : "normal"],
    ["red", view.objects.redLeg?.colorize ? "colorized" : "normal"],
    ["yellow", view.objects.yellowLeg?.visible === false ? "hidden" : `opacity ${Number(opacitySlider.value).toFixed(2)}`]
  ];
  status.innerHTML = states
    .map(([name, state]) => `<span>${name}: <code>${state}</code></span>`)
    .join("<br>");
}

function createTableModelParams(TrianglesPrimitive) {
  return {
    id: "webgpuObjectStatesTable",
    geometries: [
      createBoxGeometryParams("demoBoxGeometry", TrianglesPrimitive)
    ],
    meshes: [
      {
        id: "redLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [-4, -4, 3],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [1, 0.3, 0.3],
        opacity: 1
      },
      {
        id: "greenLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [4, -4, 3],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [0.3, 1.0, 0.3],
        opacity: 1
      },
      {
        id: "blueLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [4, 4, 3],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [0.3, 0.3, 1.0],
        opacity: 1
      },
      {
        id: "yellowLeg-mesh",
        geometryId: "demoBoxGeometry",
        position: [-4, 4, 3],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [1.0, 1.0, 0.0],
        opacity: 1
      },
      {
        id: "tableTop-mesh",
        geometryId: "demoBoxGeometry",
        position: [0, 0, 6],
        scale: [6, 6, 0.5],
        rotation: [0, 0, 0],
        color: [1.0, 0.3, 1.0],
        opacity: 1
      }
    ],
    objects: [
      {id: "redLeg", meshIds: ["redLeg-mesh"]},
      {id: "greenLeg", meshIds: ["greenLeg-mesh"]},
      {id: "blueLeg", meshIds: ["blueLeg-mesh"]},
      {id: "yellowLeg", meshIds: ["yellowLeg-mesh"]},
      {id: "purpleTableTop", meshIds: ["tableTop-mesh"]}
    ]
  };
}

function createBoxGeometryParams(id, primitive) {
  return {
    id,
    primitive,
    positions: [
      1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
      1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1,
      1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1,
      -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1,
      -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
      1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
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
      4, 5, 5, 6, 6, 7, 7, 4,
      8, 9, 9, 10, 10, 11, 11, 8,
      12, 13, 13, 14, 14, 15, 15, 12,
      16, 17, 17, 18, 18, 19, 19, 16,
      20, 21, 21, 22, 22, 23, 23, 20
    ]
  };
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
  panel.dataset.state = "error";
  status.innerHTML = `<span>${escapeHTML(message)}</span>`;
  console.error("[view/webgpu/object-states]", message);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
