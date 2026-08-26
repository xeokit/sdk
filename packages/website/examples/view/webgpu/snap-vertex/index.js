import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const status = document.getElementById("status");
const canvas = document.getElementById("demoCanvas");
const marker = document.getElementById("marker");
const VERTEX_SNAP_RADIUS = 32;
let pickRequestSeq = 0;
let pickInFlight = false;
let pendingCanvasPos = null;

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
    id: "webgpuVertexSnapView",
    htmlElement: canvas,
    backgroundColor: [0.08, 0.10, 0.16],
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
      reportError("[view/webgpu/snap-vertex] WebGPU renderer is attached to the Viewer, but has no active ViewManager.");
      return;
    }
  }
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error);
  });

  const inputController = createInputController(InputController, view);

  mustOk(scene.createModel(createTableModelParams(TrianglesPrimitive)));

  canvas.addEventListener("mousemove", (event) => {
    schedulePick(renderer, view, getCanvasPos(event));
  });

  canvas.addEventListener("mouseleave", () => {
    pickRequestSeq++;
    pendingCanvasPos = null;
    marker.style.display = "none";
    renderReady();
  });

  renderReady();
  view.needsRender();

  window.addEventListener("resize", () => {
    view.needsRender();
  });

  window.webgpuSnapVertexDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController
  };
}

async function schedulePick(renderer, view, canvasPos) {
  pendingCanvasPos = canvasPos;
  if (pickInFlight) {
    return;
  }

  pickInFlight = true;
  try {
    while (pendingCanvasPos) {
      const activeCanvasPos = pendingCanvasPos;
      pendingCanvasPos = null;
      const requestSeq = ++pickRequestSeq;
      const pickStart = performance.now();
      const result = await pickWithPreferredPath(renderer, view, {
        canvasPos: activeCanvasPos,
        snapToVertex: true,
        snapRadius: VERTEX_SNAP_RADIUS
      });
      if (requestSeq !== pickRequestSeq) {
        continue;
      }
      if (!result.ok) {
        reportError(result.error);
        continue;
      }
      renderSnapResult(result.value, result.path, performance.now() - pickStart);
    }
  } finally {
    pickInFlight = false;
    if (pendingCanvasPos) {
      void schedulePick(renderer, view, pendingCanvasPos);
    }
  }
}

function renderReady() {
  status.dataset.state = "ok";
  status.innerHTML =
    "<strong>WebGPU Vertex Snap</strong>" +
    "<span>Move near a table corner. Uses async GPU snap readback when available, with sync CPU fallback.</span>";
}

function renderSnapResult(pickResult, path, durationMs) {
  if (!pickResult || !pickResult.snappedToVertex || !pickResult.snappedCanvasPos) {
    marker.style.display = "none";
    status.innerHTML =
      "<strong>WebGPU Vertex Snap</strong>" +
      `<span>${escapeHTML(path)}: no table vertex within the snap radius. <code>${durationMs.toFixed(2)}ms</code></span>`;
    return;
  }

  marker.style.display = "block";
  marker.style.left = `${pickResult.snappedCanvasPos[0]}px`;
  marker.style.top = `${pickResult.snappedCanvasPos[1]}px`;
  status.innerHTML =
    "<strong>WebGPU Vertex Snap</strong>" +
    `<span>Path: <code>${escapeHTML(path)}</code> <code>${durationMs.toFixed(2)}ms</code></span><br>` +
    `<span>Object: <code>${escapeHTML(pickResult.viewObject?.id || "none")}</code></span><br>` +
    `<span>Snapped canvas: <code>${formatVec(pickResult.snappedCanvasPos, 1)}</code></span><br>` +
    `<span>Snapped world: <code>${formatVec(pickResult.worldPos, 3)}</code></span>`;
}

async function pickWithPreferredPath(renderer, view, pickParams) {
  if (typeof renderer.pickGPUAsync === "function") {
    const result = await renderer.pickGPUAsync(view, pickParams);
    return {
      ...result,
      path: "GPU async"
    };
  }
  return {
    ...renderer.pick(view, pickParams),
    path: "CPU sync"
  };
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

function createTableModelParams(TrianglesPrimitive) {
  return {
    id: "webgpuSnapVertexTable",
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
  status.innerHTML = `<strong>WebGPU Vertex Snap</strong><span>${escapeHTML(message)}</span>`;
  console.error("[view/webgpu/snap-vertex]", message);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
