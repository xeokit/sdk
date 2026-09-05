import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const MODEL_ID = "WestRiverSideHospital";
const MODEL_BASE = `../../../../models/${MODEL_ID}`;
const HOSPITAL_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters"
};

main().catch((error) => failExample("import/xgf/west-river-side-hospital", error));

async function main() {
  const canvas = mustElement("demoCanvas");
  if (canvas) {
    canvas.style.visibility = "hidden";
  }
  setStatus("status", "Loading West Riverside Hospital XGF...");

  // Create a compact, efficient View for this large BIM model: edges and SAO
  // help readability, while heavier PBR effects are left off.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: canvas,
    backgroundColor: [0.78, 0.86, 0.94],
    camera: {
      eye: [145, -235, 252],
      look: [42, -82, 181],
      up: [0, 0, 1],
      perspectiveProjection: {far: 1000}
    },
    effects: {
      edges: {enabled: true, useMeshColor: true, edgeWidth: 1},
      sao: {enabled: true, intensity: 0.08, scale: 0.8},
      tonemap: {enabled: true, sRGBEncode: true},
      sky: {
        enabled: true,
        skyColor: [0.58, 0.74, 0.92],
        horizonColor: [0.72, 0.8, 0.86],
        groundColor: [0.46, 0.5, 0.46],
        horizonBlend: 0.42
      }
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));
  view.clearLights();
  new AmbientLight(view, {color: [1, 1, 1], intensity: 0.22});
  new DirLight(view, {dir: [-0.42, -0.62, -0.72], color: [1, 0.96, 0.88], intensity: 1.25, space: "world"});

  // Connect navigation to the large model through renderer picking.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // This is the model coordinate-system sidecar inlined at the API boundary.
  const sceneModel = mustOk(scene.createModel({
    id: MODEL_ID,
    coordinateSystem: HOSPITAL_COORDINATE_SYSTEM,
    memoryPolicy: "compact"
  }));

  // Fetch the XGF bytes and decode them into the compact SceneModel. XGF is
  // already xeokit-native, so no external geometry conversion is needed here.
  const fileData = await fetchArrayBuffer(`${MODEL_BASE}/xgf/model.xgf`);
  const loadResult = await new XGFLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  document.getElementById("status")?.style.setProperty("display", "none");
  if (canvas) {
    canvas.style.visibility = "visible";
  }

  // The initial camera is already arranged for this large model.
  finishExample(renderer, view);
  window.xgfWestRiverSideHospitalExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") {
    return configureExampleRenderer(viewer, new WebGLRenderer({viewer}));
  }
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) {
    throw new Error(result.error);
  }
  return configureExampleRenderer(viewer, result.value);
}
