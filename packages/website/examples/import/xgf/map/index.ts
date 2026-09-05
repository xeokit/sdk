import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {SceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {addSlider, failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";
import {SceneModelExploder} from "@xeokit/website-presentations/exploder";

const XGF_URL = "../../../../models/MAP/xgf/model.xgf";
const COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, -1],
  origin: [0, 0, 0],
  units: "meters"
};

main().catch((error) => failExample("import/xgf/map", error));

async function main() {
  // XGF can populate both native xeokit geometry and semantic metadata.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    camera: {
      eye: [1841990.2778388674, 5173295.7011186555, 16.25441882894172],
      look: [1842022.2883483584, 5173301.846981712, 10.494716146446603],
      up: [0.1708873388776124, 0.032809545530215846, 0.9847441551659135]
    },
    effects: {
      edges: {enabled: true, useMeshColor: true, edgeWidth: 1},
      tonemap: {enabled: true, sRGBEncode: true}
    }
  }));
  const renderer = await createRenderer(viewer);
  const collisionIndex = new SceneCollisionIndex(scene);

  // Navigation and the exploder both use scene spatial data built from this model.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Create both target models before loading. XGF can populate SceneModel
  // geometry and DataModel metadata in one pass.
  const dataModel = mustOk(data.createModel({id: "demoModel"}));
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: COORDINATE_SYSTEM,
    updateHint: "static"
  }));

  // Fetch and load the XGF bytes into the prepared models.
  setStatus("status", "Loading XGF...");
  const fileData = await fetchArrayBuffer(XGF_URL);
  const loadResult = await new XGFLoader().load({fileData, sceneModel, dataModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The exploder is View/Scene presentation state layered on top of the loaded
  // SceneModel; it is not part of the XGF payload.
  const exploder = new SceneModelExploder({scene, sceneModel, collisionIndex});
  exploder.rebuild();
  exploder.setFactor(0);
  const panel = document.createElement("div");
  panel.className = "xeokit-example-panel";
  document.body.appendChild(panel);
  addSlider(panel, {label: "Explode", min: 0, max: 2, step: 0.05, value: 0, digits: 2, onChange: (value) => exploder.setFactor(value)});
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.webgpuXGFMapDemo = {scene, data, viewer, view, renderer, picker, inputController, collisionIndex, sceneModel, dataModel, exploder};
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
