import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const GLB_URL = "../../../../models/MAP/gltf/model.glb";
const COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters"
};

main().catch((error) => failExample("import/gltf/map", error));

async function main() {
  // Create separate render and semantic stores. The SceneModel receives geometry;
  // the DataModel receives object metadata decoded by GLTFLoader.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    texturing: {enabled: true},
    camera: {
      projection: "perspective",
      eye: [1841990.28, -5173295.7, 16.25],
      look: [1842022.29, -5173301.85, 10.49],
      up: [0.17, -0.03, 0.98]
    },
    effects: {
      edges: {enabled: false},
      tonemap: {enabled: true, sRGBEncode: true}
    }
  }));
  const renderer = await createRenderer(viewer);

  // Navigation uses renderer picking against the geospatial model.
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

  // The MAP glTF includes semantic data, so create a DataModel alongside the
  // SceneModel and pass both targets to GLTFLoader.
  const dataModel = mustOk(data.createModel({id: "demoModel"}));
  setStatus("status", "Loading glTF...");
  const fileData = await fetchArrayBuffer(GLB_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const loadResult = await new GLTFLoader().load({fileData, sceneModel, dataModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for the geospatial model.
  finishExample(renderer, view);

  window.mapGltfExample = {scene, data, dataModel, sceneModel, view, renderer};
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
