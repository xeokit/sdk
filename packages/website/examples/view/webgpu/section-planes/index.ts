import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController as InputController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {finishExample, mustOk, noPick, signalExampleLoaded} from "../../../utils/standaloneRuntime.js";

const status = document.getElementById("status");
const panel = document.getElementById("panel");
const canvas = document.getElementById("demoCanvas");
const cutSlider = document.getElementById("cutSlider");
const cutValue = document.getElementById("cutValue");
const activeToggle = document.getElementById("activeToggle");
const capsToggle = document.getElementById("capsToggle");
const legToggle = document.getElementById("legToggle");
const CAP_COLOR = [0.12, 0.70, 0.92];

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  if (!navigator.gpu) {
    reportError("This browser does not expose navigator.gpu. Use a WebGPU-enabled browser to run this example.");
    return;
  }

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "webgpuSectionPlaneView",
    htmlElement: canvas,
    backgroundColor: [0.06, 0.10, 0.13],
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

  const sectionPlane = mustOk(view.createSectionPlane({
    id: "webgpuDemoCut",
    pos: [Number(cutSlider.value), 0, 0],
    dir: [1, 0, 0],
    active: activeToggle.checked,
    capColor: CAP_COLOR
  }));
  applyCaps(view, sectionPlane);

  cutSlider.addEventListener("input", () => {
    sectionPlane.pos = [Number(cutSlider.value), 0, 0];
    renderStatus(view, sectionPlane);
  });
  activeToggle.addEventListener("change", () => {
    sectionPlane.active = activeToggle.checked;
    renderStatus(view, sectionPlane);
  });
  capsToggle.addEventListener("change", () => {
    applyCaps(view, sectionPlane);
    renderStatus(view, sectionPlane);
  });
  legToggle.addEventListener("change", () => {
    const yellowLeg = view.objects.yellowLeg;
    if (yellowLeg) {
      yellowLeg.clippable = !legToggle.checked;
    }
    renderStatus(view, sectionPlane);
  });

  renderStatus(view, sectionPlane);
  finishExample(renderer, view);

  window.addEventListener("resize", () => {
  });

  window.webgpuSectionPlanesDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController,
    sectionPlane,
    capsToggle
  };
}

function applyCaps(view, sectionPlane) {
  sectionPlane.capColor = capsToggle.checked ? CAP_COLOR : null;
  view.effects.sectionPlaneCaps.enabled = true;
}

function renderStatus(view, sectionPlane) {
  panel.dataset.state = "ok";
  const cut = Number(cutSlider.value);
  cutValue.textContent = cut.toFixed(1);
  const yellowLeg = view.objects.yellowLeg;
  const yellowState = yellowLeg?.clippable === false ? "ignores clipping" : "is clippable";
  const capsState = view.effects.sectionPlaneCaps.applied && sectionPlane.capColor ? "on" : "off";
  status.innerHTML =
    `<span>Active plane clips fragments where <code>x &gt; ${cut.toFixed(1)}</code>.</span><br>` +
    `<span>The shared box geometry is reused by five objects; the yellow leg ${yellowState}.</span><br>` +
    `<span>Plane active: <code>${sectionPlane.active ? "yes" : "no"}</code>; cap color: <code>${capsState}</code></span>`;
}

function createTableModelParams(TrianglesPrimitive) {
  return {
    id: "webgpuSectionPlaneTable",
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


function reportError(message) {
  panel.dataset.state = "error";
  status.innerHTML = `<span>${escapeHTML(message)}</span>`;
  signalExampleLoaded();
  console.error("[view/webgpu/section-planes]", message);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
