import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {encodeRadianceHDR, paintStudioHDR} from "@xeokit/sdk/model/generation/paintEnvironments";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const XGF_URL = "../../../../models/HousePlan/xgf/model.xgf";
const SUN_DIRECTION = [-0.46, -0.54, -0.7];
const XGF_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters"
};

main().catch((error) => failExample("import/xgf/house-plan-pbr", error));

async function main() {
  // Create a PBR-oriented View before loading the XGF payload.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    adaptiveQuality: false,
    backgroundColor: [0.96, 0.955, 0.94],
    camera: {
      eye: [1396.192488512606, -228.91295922593062, 7.605782942380627],
      look: [1389.9821022363608, -234.97883380249922, 1.9956860109231078],
      up: [-0.3882818817391334, -0.3792467944611508, 0.8398863311210985]
    },
    effects: {
      edges: {enabled: false},
      sao: {enabled: true, intensity: 0.11, scale: 0.85, radius: 14, bias: 0.04, blur: true},
      shadows: {enabled: true, intensity: 0.44, direction: SUN_DIRECTION, autoFit: true, resolution: 2048, pcfKernelSize: 2, cascadeCount: 4},
      colorGrading: {enabled: true, brightness: 0, contrast: 1.04, saturation: 1.04, gamma: 0.98, temperature: 0.06, tint: 0.04},
      tonemap: {enabled: true, mode: "aces", exposure: 0.95, sRGBEncode: true},
      antiAliasing: {enabled: true},
      atmosphere: {enabled: false},
      bloom: {enabled: false},
      sky: {enabled: false}
    },
    lights: {
      ibl: {enabled: true, intensity: 1},
      hemispheric: {enabled: true, intensity: 0.08}
    },
    texturing: {enabled: true}
  }));
  const renderer = await createRenderer(viewer);
  view.clearLights();
  new AmbientLight(view, {color: [1, 1, 1], intensity: 0.34});
  new DirLight(view, {dir: SUN_DIRECTION, color: [1, 0.96, 0.88], intensity: 1.18, space: "world"});
  const hdrBuffer = encodeRadianceHDR(paintStudioHDR(1024, 512), 1024, 512);
  const iblResult = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuffer);
  if (!iblResult.ok) {
    throw new Error(iblResult.error);
  }

  // Connect navigation to the XGF geometry through renderer picking.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // XGF is loaded from bytes into an explicitly created SceneModel. The View is
  // already configured for the textured PBR scene before load.
  setStatus("status", "Loading House Plan XGF...");
  const fileData = await fetchArrayBuffer(XGF_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "housePlan",
    coordinateSystem: XGF_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const loadResult = await new XGFLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this model.
  document.getElementById("status")?.style.setProperty("display", "none");
  document.getElementById("panel")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.housePlanXGFExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
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
