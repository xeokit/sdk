import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const TILE_SIZE = 200;
const WORLD_BASE = [1000000, 5173200, 0];
const POSITIONS = [
  {id: "west", label: "West", position: [WORLD_BASE[0] - 220, WORLD_BASE[1] + 60, 8]},
  {id: "center", label: "Center", position: [WORLD_BASE[0] + 40, WORLD_BASE[1] + 60, 8]},
  {id: "east", label: "East", position: [WORLD_BASE[0] + 260, WORLD_BASE[1] + 60, 8]},
  {id: "north", label: "North", position: [WORLD_BASE[0] + 260, WORLD_BASE[1] + 310, 8]}
];

const panel = document.getElementById("panel");
const status = document.getElementById("status");
const details = document.getElementById("details");
const controls = document.getElementById("controls");
const canvas = document.getElementById("demoCanvas");

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  if (!navigator.gpu) {
    reportError("This browser does not expose navigator.gpu. Use a WebGPU-enabled browser to run this example.");
    return;
  }

  const {Scene, buildMat4} = xeokit.model.scene;
  const {Viewer} = xeokit.viewing.viewer;
  const {ModelNavigationController: InputController} = xeokit.viewing.navigation.model;
  const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;
  const {TrianglesPrimitive} = xeokit.base.constants;

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "webgpuRTCTilesView",
    htmlElement: canvas,
    backgroundColor: [0.043, 0.071, 0.125],
    camera: {
      projection: "perspective",
      far: 20000000,
      eye: [WORLD_BASE[0] + 560, WORLD_BASE[1] - 700, 420],
      look: [WORLD_BASE[0] + 80, WORLD_BASE[1] + 130, 15],
      up: [0, 0, 1]
    }
  }));

  const rendererResult = await WebGPURenderer.create({
    viewer,
    logging: true,
    memoryConfigs: {
      tileSize: TILE_SIZE,
      maxTiles: 64,
      frustumCulling: false,
      minProjectedCanvasSize: 0
    }
  });

  if (!rendererResult.ok) {
    reportError(rendererResult.error);
    return;
  }

  const renderer = rendererResult.value;
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error);
  });
  const renderInspectorResult = renderer.getRenderInspector?.();
  const renderInspector = renderInspectorResult?.ok ? renderInspectorResult.value : null;
  if (renderInspector) {
    renderInspector.enabled = true;
  }

  const inputController = new InputController(view, {
    pick: noPick,
    followPointer: false,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 160,
    keyboardPanRate: 80,
    mouseWheelDollyRate: 520,
    touchDollyRate: 0.24
  });

  const sceneModel = mustOk(scene.createModel({
    id: "webgpuRTCTileDemoModel",
    updateHint: "dynamic",
    lifecycle: "dynamic",
    memoryPolicy: "stream",
    geometries: [
      createBoxGeometryParams("boxGeometry", TrianglesPrimitive)
    ],
    meshes: [
      createBoxMeshParams("anchorWestMesh", "boxGeometry", [WORLD_BASE[0] - 220, WORLD_BASE[1] - 120, 8], [32, 32, 16], [0.26, 0.62, 1.0]),
      createBoxMeshParams("anchorCenterMesh", "boxGeometry", [WORLD_BASE[0] + 40, WORLD_BASE[1] - 120, 8], [32, 32, 16], [0.38, 0.9, 0.58]),
      createBoxMeshParams("anchorEastMesh", "boxGeometry", [WORLD_BASE[0] + 260, WORLD_BASE[1] - 120, 8], [32, 32, 16], [0.95, 0.72, 0.28]),
      createBoxMeshParams("movingMesh", "boxGeometry", POSITIONS[1].position, [42, 42, 24], [1.0, 0.28, 0.42])
    ],
    objects: [
      {id: "anchorWest", meshIds: ["anchorWestMesh"]},
      {id: "anchorCenter", meshIds: ["anchorCenterMesh"]},
      {id: "anchorEast", meshIds: ["anchorEastMesh"]},
      {id: "movingObject", meshIds: ["movingMesh"]}
    ]
  }));

  const movingMesh = sceneModel.meshes.movingMesh;
  let activePosition = POSITIONS[1];

  for (const position of POSITIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = position.label;
    button.dataset.positionId = position.id;
    button.addEventListener("click", () => {
      activePosition = position;
      movingMesh.matrix = buildMat4({
        position: position.position,
        scale: [42, 42, 24]
      });
      updateButtons();
      renderStatus({renderer, renderInspector, view, sceneModel, movingMesh, activePosition});
      view.needsRender();
    });
    controls.appendChild(button);
  }

  updateButtons();
  renderer.events.onViewRendered.subscribe((_renderer, renderedView) => {
    if (renderedView === view) {
      renderStatus({renderer, renderInspector, view, sceneModel, movingMesh, activePosition});
    }
  });
  renderStatus({renderer, renderInspector, view, sceneModel, movingMesh, activePosition});
  view.needsRender();

  window.addEventListener("resize", () => {
    view.needsRender();
  });

  window.webgpuRTCTilesDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController,
    sceneModel,
    movingMesh,
    positions: POSITIONS,
    moveTo(id) {
      const position = POSITIONS.find((candidate) => candidate.id === id);
      if (!position) {
        throw new Error(`Unknown RTC tile demo position: ${id}`);
      }
      activePosition = position;
      movingMesh.matrix = buildMat4({
        position: position.position,
        scale: [42, 42, 24]
      });
      updateButtons();
      renderStatus({renderer, renderInspector, view, sceneModel, movingMesh, activePosition});
      view.needsRender();
    }
  };

  function updateButtons() {
    for (const button of controls.querySelectorAll("button")) {
      button.dataset.active = button.dataset.positionId === activePosition.id ? "true" : "false";
    }
  }
}

function renderStatus({renderer, renderInspector, view, sceneModel, movingMesh, activePosition}) {
  panel.dataset.state = "ok";
  const viewIndex = view.viewIndex ?? 0;
  const summary = renderer.getViewRenderStats?.(viewIndex);
  const frame = renderInspector?.renderStats?.views?.[viewIndex];
  const world = getMatrixTranslation(movingMesh.worldMatrix || movingMesh.matrix);
  const center = computeRTCCenter(world);
  const local = [
    world[0] - center[0],
    world[1] - center[1],
    world[2] - center[2]
  ];
  status.textContent = `Moving mesh: ${activePosition.label}`;
  details.innerHTML =
    `<span>World position: <code>${formatVec(world)}</code></span>` +
    `<span>Computed RTC center: <code>${formatVec(center)}</code></span>` +
    `<span>Tile-local position: <code>${formatVec(local)}</code></span>` +
    `<span>Model: <code>${Object.keys(sceneModel.objects).length}</code> objects, <code>${Object.keys(sceneModel.meshes).length}</code> meshes.</span>` +
    `<span>Last WebGPU frame: <code>${formatNumber(summary?.numDrawCalls ?? frame?.numDrawCalls ?? 0)}</code> draws, <code>${formatNumber(summary?.numBatches ?? frame?.numBatches ?? 0)}</code> batches, <code>${formatNumber(summary?.numPrimitives ?? frame?.numPrims ?? 0)}</code> triangles.</span>`;
}

function createBoxMeshParams(id, geometryId, position, scale, color) {
  return {
    id,
    geometryId,
    position,
    scale,
    rotation: [0, 0, 0],
    color,
    opacity: 1
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

function computeRTCCenter(world) {
  return [
    Math.round(world[0] / TILE_SIZE) * TILE_SIZE,
    Math.round(world[1] / TILE_SIZE) * TILE_SIZE,
    Math.round(world[2] / TILE_SIZE) * TILE_SIZE
  ];
}

function getMatrixTranslation(matrix) {
  return [matrix[12], matrix[13], matrix[14]];
}

function formatVec(value) {
  return value.map((component) => Number(component).toFixed(2)).join(", ");
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
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
  status.textContent = message;
  console.error("[view/webgpu/rtc-tiles]", message);
}
