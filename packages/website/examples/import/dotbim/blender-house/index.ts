import {DotBIMLoader} from "@xeokit/sdk/formats/dotbim";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, finishExample, mustElement, mustOk, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const DOTBIM_URL = "../../../../models/BlenderHouse/dotbim/model.bim";
const DOTBIM_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0] as [number, number, number, number, number, number, number, number, number],
  origin: [0, 0, 0] as [number, number, number],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => {
  failExample("dotbim-blender-house", error);
});

async function main() {
  // DotBIM carries render geometry plus BIM object metadata.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      projection: "perspective",
      eye: [11.28, 16.91, 7.40],
      look: [0, 0, 0],
      up: [-0.19, -0.28, 0.94]
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect navigation to object picking in the loaded building.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Create explicit target models before passing them to DotBIMLoader.
  const sceneModel = mustOk(scene.createModel({
    id: "demoModel",
    coordinateSystem: DOTBIM_COORDINATE_SYSTEM
  }));
  const dataModel = mustOk(data.createModel({id: "demoModel"}));
  const fileData = await fetchJSON(DOTBIM_URL);

  const loadResult = await new DotBIMLoader().load({
    fileData,
    sceneModel,
    dataModel
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The view was created with an explicit camera for this BlenderHouse export.
  finishExample(renderer, view);

  Object.assign(window, {dotBIMBlenderHouseExample: {scene, data, viewer, view, renderer, picker, inputController, sceneModel, dataModel}});
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
