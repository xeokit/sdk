import {CityJSONLoader} from "@xeokit/sdk/formats/cityjson";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, finishExample, mustElement, mustOk, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const CITYJSON_URL = "../../../../models/LoD3_Railway/cityjson/model.json";
// This is the contents of models/LoD3_Railway/coordSys.json, inlined so the
// coordinate-system contract is visible at SceneModel creation. The CityJSON
// geometry is authored Y-up, so source Y maps onto xeokit's scene Z axis.
const CITYJSON_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters"
};

main().catch((error) => {
  failExample("cityjson-railway", error);
});

async function main() {
  // CityJSONLoader can populate both geometry and semantic object data.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      eye: [11.50, 16.32, 15.12],
      look: [9.01, 9.65, 11.22],
      up: [-0.16, -0.45, 0.87]
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect camera navigation to renderer-backed picking.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Create the target models, then load the parsed CityJSON document into them.
  const sceneModel = mustOk(scene.createModel({id: "demoModel", coordinateSystem: CITYJSON_COORDINATE_SYSTEM}));
  const dataModel = mustOk(data.createModel({id: "demoModel"}));
  const fileData = await fetchJSON(CITYJSON_URL);

  const loadResult = await new CityJSONLoader().load({
    fileData,
    sceneModel,
    dataModel
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  finishExample(renderer, view);

  Object.assign(window, {cityJSONRailwayExample: {scene, data, viewer, view, renderer, picker, inputController, sceneModel, dataModel}});
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
