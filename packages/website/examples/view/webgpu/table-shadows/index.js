import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const status = document.getElementById("status");
const canvas = document.getElementById("demoCanvas");
const shadowEnabled = document.getElementById("shadowEnabled");
const shadowIntensity = document.getElementById("shadowIntensity");
const shadowBias = document.getElementById("shadowBias");
const shadowDebug = document.getElementById("shadowDebug");

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  if (!navigator.gpu) {
    reportError("This browser does not expose navigator.gpu. Use a WebGPU-enabled browser to run this example.");
    return;
  }

  const {Scene} = xeokit.model.scene;
  const {Viewer, AmbientLight, DirLight} = xeokit.viewing.viewer;
  const {ModelNavigationController: InputController} = xeokit.viewing.navigation.model;
  const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "webgpuTableShadowsView",
    htmlElement: canvas,
    backgroundColor: [0.94, 0.96, 0.98],
    camera: {
      projection: "perspective",
      far: 1000,
      eye: [13, -16, 11],
      look: [0, 0, 3],
      up: [0, 0, 1]
    },
    effects: {
      sao: {
        enabled: true,
        intensity: 0.12,
        kernelRadius: 60,
        numSamples: 12,
        blur: true
      },
      shadows: {
        enabled: true,
        intensity: 0.68,
        bias: 0.0008,
        normalOffsetBias: 0.01,
        slopeBias: 0.0008,
        resolution: 2048,
        direction: [-0.32, -0.28, -0.90],
        autoFit: true,
        projectionSize: 13,
        lightDistance: 120,
        maxDistance: 180,
        padding: 1.2,
        cascadeCount: 4,
        cascadeSplitLambda: 0.55
      },
      tonemap: {
        enabled: false
      },
      edges: {
        enabled: false
      }
    }
  }));

  view.clearLights();
  new AmbientLight(view, {
    color: [1, 1, 1],
    intensity: 0.05
  });
  new DirLight(view, {
    dir: view.effects.shadows.direction,
    color: [1.0, 0.95, 0.86],
    intensity: 2.15,
    space: "world"
  });
  view.effects.sky.enabled = false;

  const rendererResult = await WebGPURenderer.create({
    viewer,
    logging: true
  });
  if (!rendererResult.ok) {
    reportError(rendererResult.error);
    return;
  }

  const renderer = rendererResult.value;
  const inspectorResult = renderer.getRenderInspector();
  if (inspectorResult.ok) {
    inspectorResult.value.enabled = true;
  }
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error);
  });

  const inputController = createInputController(InputController, view, {
    keyboardDollyRate: 8,
    keyboardPanRate: 4,
    mouseWheelDollyRate: 60,
    touchDollyRate: 0.14
  });

  const sceneModel = mustOk(scene.createModel({
    id: "webgpuTableShadowsModel",
    updateHint: "static"
  }));
  mustOk(sceneModel.fromParams(createTableShadowModelParams()));
  sceneModel.objects.floor.castsShadow = false;
  if (view.objects.floor) {
    view.objects.floor.castsShadow = false;
  }

  bindShadowControls(view);

  renderer.events.onViewRendered.subscribe((_renderer, renderedView) => {
    if (renderedView !== view) {
      return;
    }
    const viewIndex = view.viewIndex ?? 0;
    const renderStats = renderer.getViewRenderStats?.(viewIndex);
    const shadowBin = (renderStats?.renderBins || []).find((bin) => bin.name === "SHADOW_DEPTH");
    const shadowPass = shadowBin
      ? `shadow depth pass active (${shadowBin.numDrawCalls} draw)`
      : "shadow depth pass idle";
    status.dataset.state = "ok";
    status.innerHTML =
      "<strong>WebGPU Table Shadows</strong>" +
      `<span>Rendering a generated table over a receiving floor with WebGPU directional shadows; ${shadowPass}.</span>`;
  });

  view.needsRender();

  window.addEventListener("resize", () => {
    view.needsRender();
  });

  window.webgpuTableShadowsDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController,
    sceneModel,
    setShadowsEnabled: (enabled) => {
      setShadowsEnabled(view, !!enabled);
    }
  };
}

function bindShadowControls(view) {
  shadowEnabled.checked = view.effects.shadows.enabled;
  shadowIntensity.value = String(view.effects.shadows.intensity);
  shadowBias.value = String(view.effects.shadows.bias);
  shadowDebug.value = view.effects.shadows.debug || "";

  shadowEnabled.addEventListener("change", () => {
    setShadowsEnabled(view, shadowEnabled.checked);
  });
  shadowIntensity.addEventListener("input", () => {
    view.effects.shadows.intensity = Number(shadowIntensity.value);
    view.needsRender();
  });
  shadowBias.addEventListener("input", () => {
    view.effects.shadows.bias = Number(shadowBias.value);
    view.needsRender();
  });
  shadowDebug.addEventListener("change", () => {
    view.effects.shadows.debug = shadowDebug.value || false;
    view.effects.sao.enabled = true;
    view.needsRender();
  });
}

function setShadowsEnabled(view, enabled) {
  view.effects.shadows.enabled = true;
  view.needsRender();
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

function createTableShadowModelParams() {
  const {TrianglesPrimitive} = xeokit.base.constants;

  return {
    geometries: [{
      id: "boxGeometry",
      primitive: TrianglesPrimitive,
      positions: [
        1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
        1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1,
        1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1,
        -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1,
        1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1,
        1, -1, 1, -1, -1, 1, -1, -1, -1, 1, -1, -1
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
        0, 4, 1, 7, 2, 6, 3, 5
      ]
    }],
    meshes: [
      {
        id: "floorMesh",
        geometryId: "boxGeometry",
        position: [0, 0, -0.08],
        scale: [13, 10, 0.08],
        color: [0.86, 0.88, 0.82],
        opacity: 1
      },
      {
        id: "tableTopMesh",
        geometryId: "boxGeometry",
        position: [0, 0, 4.8],
        scale: [4.6, 3.1, 0.35],
        color: [0.52, 0.33, 0.18],
        opacity: 1
      },
      {
        id: "legNwMesh",
        geometryId: "boxGeometry",
        position: [-3.7, 2.2, 2.3],
        scale: [0.32, 0.32, 2.3],
        color: [0.38, 0.23, 0.12],
        opacity: 1
      },
      {
        id: "legNeMesh",
        geometryId: "boxGeometry",
        position: [3.7, 2.2, 2.3],
        scale: [0.32, 0.32, 2.3],
        color: [0.38, 0.23, 0.12],
        opacity: 1
      },
      {
        id: "legSwMesh",
        geometryId: "boxGeometry",
        position: [-3.7, -2.2, 2.3],
        scale: [0.32, 0.32, 2.3],
        color: [0.38, 0.23, 0.12],
        opacity: 1
      },
      {
        id: "legSeMesh",
        geometryId: "boxGeometry",
        position: [3.7, -2.2, 2.3],
        scale: [0.32, 0.32, 2.3],
        color: [0.38, 0.23, 0.12],
        opacity: 1
      }
    ],
    objects: [
      {id: "floor", meshIds: ["floorMesh"]},
      {id: "tableTop", meshIds: ["tableTopMesh"]},
      {id: "legNW", meshIds: ["legNwMesh"]},
      {id: "legNE", meshIds: ["legNeMesh"]},
      {id: "legSW", meshIds: ["legSwMesh"]},
      {id: "legSE", meshIds: ["legSeMesh"]}
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
  status.innerHTML = `<strong>WebGPU Table Shadows</strong><span>${escapeHTML(message)}</span>`;
  console.error("[view/webgpu/table-shadows]", message);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
