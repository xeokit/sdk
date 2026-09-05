import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const XGF_URL = "../../../../models/SportsCar/xgf/model.xgf";

main().catch((error) => failExample("import/xgf/sports-car", error));

async function main() {
  // Create the scene graph, renderer, and a View with simple daylight.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {eye: [3.27, 3.91, 2.39], look: [0, 0, 0], up: [-0.18, -0.28, 0.93]},
    effects: {edges: {enabled: false}, tonemap: {enabled: true, sRGBEncode: true}},
    texturing: {enabled: true}
  }));
  const renderer = await createRenderer(viewer);
  view.clearLights();
  new AmbientLight(view, {color: [1, 1, 1], intensity: 0.18});
  new DirLight(view, {dir: [-0.42, -0.62, -0.72], color: [1, 0.96, 0.88], intensity: 1.35, space: "world"});

  // Connect navigation to the XGF objects created below.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // XGF contains xeokit-native scene payloads. The sports car is loaded as a
  // dynamic model because the example changes object style bins after load.
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    },
    updateHint: "dynamic"
  }));
  setStatus("status", "Loading SportsCar XGF...");
  const fileData = await fetchArrayBuffer(XGF_URL);
  const loadResult = await new XGFLoader().load({fileData, sceneModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // Style bins are View state, applied after XGFLoader has created objects.
  view.setObjectsInStyleBin("xrayed", view.objectIds, true);
  view.setObjectsInStyleBin("xrayed", view.objectIds.slice(30, 40), false);
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.sportsCarXGFExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
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
