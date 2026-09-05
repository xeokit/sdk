import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {encodeRadianceHDR, paintStudioHDR} from "@xeokit/sdk/model/generation/paintEnvironments";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight} from "@xeokit/sdk/viewing/viewer";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const HOUSE_PLAN_URL = "../../../../models/HousePlan/gltf/model.glb";
const SUN_DIRECTION = [-0.46, -0.54, -0.7];
const INITIAL_CAMERA = {
  eye: [1396.192488512606, -228.91295922593062, 7.605782942380627],
  look: [1389.9821022363608, -234.97883380249922, 1.9956860109231078],
  up: [-0.3882818817391334, -0.3792467944611508, 0.8398863311210985]
};
const GLTF_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("import/gltf/house-plan-pbr", error));

async function main() {
  // Create the scene graph and a View configured for a textured PBR building.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    adaptiveQuality: false,
    backgroundColor: [0.96, 0.955, 0.94],
    camera: INITIAL_CAMERA,
    texturing: {enabled: true},
    effects: {
      edges: {enabled: false},
      sao: {enabled: true, intensity: 0.11, scale: 0.85, radius: 14, bias: 0.04, blur: true},
      shadows: {
        enabled: true,
        intensity: 0.44,
        bias: 0.001,
        normalOffsetBias: 0.01,
        slopeBias: 0.0008,
        resolution: 2048,
        direction: SUN_DIRECTION,
        autoFit: true,
        projectionSize: 180,
        lightDistance: 420,
        maxDistance: 320,
        padding: 1.25,
        pcfKernelSize: 2,
        cascadeCount: 4,
        cascadeSplitLambda: 0.55
      },
      colorGrading: {enabled: true, brightness: 0, contrast: 1.04, saturation: 1.04, gamma: 0.98, temperature: 0.06, tint: 0.04},
      tonemap: {enabled: true, mode: "aces", exposure: 0.95, sRGBEncode: true},
      antiAliasing: {enabled: true},
      bloom: {enabled: true},
      atmosphere: {enabled: false},
      sky: {enabled: false}
    },
    lights: {
      ibl: {enabled: true, intensity: 1},
      hemispheric: {enabled: true, intensity: 0.08}
    }
  }));
  const renderer = await createRenderer(viewer);

  // Add explicit direct light and a procedural HDR environment for PBR materials.
  view.clearLights();
  new AmbientLight(view, {color: [1, 1, 1], intensity: 0.34});
  new DirLight(view, {dir: SUN_DIRECTION, color: [1, 0.96, 0.88], intensity: 1.18, space: "world"});
  const hdrBuffer = encodeRadianceHDR(paintStudioHDR(1024, 512), 1024, 512);
  const iblResult = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuffer);
  if (!iblResult.ok) {
    throw new Error(iblResult.error);
  }

  // Connect model navigation to renderer picking.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false
  });

  // GLB is loaded as bytes into an explicitly created SceneModel.
  setStatus("status", "Loading House Plan...");
  const fileData = await fetchArrayBuffer(HOUSE_PLAN_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "housePlan",
    coordinateSystem: GLTF_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const loadResult = await new GLTFLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this model.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);

  Object.assign(window, {housePlanGltfExample: {scene, viewer, view, renderer, picker, inputController, sceneModel}});
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") {
    return configureExampleRenderer(viewer, new WebGLRenderer({viewer}), {sky: false});
  }
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) {
    throw new Error(result.error);
  }
  return configureExampleRenderer(viewer, result.value, {sky: false});
}
