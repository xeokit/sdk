import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const XGF_URL = "../../../../models/Nalls-Pumpkin-Hill/xgf/model.xgf";

main().catch((error) => failExample("import/xgf/pumpkin", error));

async function main() {
  // XGF can attach semantic object data while loading, so create the Data store
  // alongside the render Scene.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    adaptiveQuality: false,
    backgroundColor: [1, 1, 1],
    effects: {sky: {enabled: false}, edges: {enabled: false}},
    camera: {
      eye: [27.16230033378987, -11.455454610739224, 21.25759320462873],
      look: [2.457399368286133, 20.841599464416504, 1.7299499660730362],
      up: [-0.26, 0.34, 0.9],
      perspectiveProjection: {far: 10000000}
    },
    pointsMaterial: {
      pointSize: 2,
      roundPoints: true,
      perspectivePoints: true,
      minPerspectivePointSize: 1,
      maxPerspectivePointSize: 5,
      filterIntensity: false,
      minIntensity: 0,
      maxIntensity: 100
    }
  }));
  const renderer = await createRenderer(viewer);
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // XGF contains xeokit-native scene payloads. Create the semantic DataModel
  // explicitly when the XGF should attach object metadata during load.
  const dataModel = mustOk(data.createModel({id: "demoModel"}));

  // Create the SceneModel before loading so coordinate-system and update policy
  // are visible. This point cloud uses the same authored basis as the LAS source.
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: {
      basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
      origin: [0, 0, 0],
      units: "meters"
    },
    updateHint: "static"
  }));

  // Fetch the XGF bytes and decode them into the prepared models.
  setStatus("status", "Loading XGF point cloud...");
  const fileData = await fetchArrayBuffer(XGF_URL);
  const loadResult = await new XGFLoader().load({fileData, sceneModel, dataModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this point cloud.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.xgfPumpkinExample = {scene, data, viewer, view, renderer, picker, inputController, sceneModel, dataModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") {
    return new WebGLRenderer({viewer});
  }
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
