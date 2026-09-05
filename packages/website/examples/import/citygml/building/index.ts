import {CityGMLLoader} from "@xeokit/sdk/formats/citygml";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchText, finishExample, mustElement, mustOk, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const CITYGML_URL = "../../../../models/OGC_CityBlock_LOD4/citygml/model.gml";
const CITYGML_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0] as [number, number, number, number, number, number, number, number, number],
  origin: [458868, 5438343, 112] as [number, number, number],
  units: "meters"
};

main().catch((error) => {
  failExample("citygml-building", error);
});

async function main() {
  // CityGML can carry semantic city objects, so create both render and data stores.
  const data = new Data();
  const scene = new Scene();
  Object.assign(scene.coordinateSystem, CITYGML_COORDINATE_SYSTEM);
  const viewer = new Viewer({scene});
  const origin = CITYGML_COORDINATE_SYSTEM.origin;

  // Use local camera coordinates by subtracting the geospatial origin in the
  // coordinate system. That preserves precision while keeping the camera readable.
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      eye: localPosition([459030, 5438330, 160], origin),
      look: localPosition([458934, 5438382, 114], origin),
      up: [0, 0, 1]
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Navigation picking lets camera interactions target the loaded city model.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  // Create the SceneModel with the same source coordinate system that defines
  // the CityGML axis basis and geospatial origin.
  const sceneModel = mustOk(scene.createModel({
    id: "citygmlBuilding",
    coordinateSystem: CITYGML_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: "citygmlBuilding"}));

  // Fetch the GML text and pass the local origin option used by CityGMLLoader
  // to convert large geospatial positions into local scene coordinates.
  const fileData = await fetchText(CITYGML_URL);
  const loadResult = await new CityGMLLoader().load({
    fileData,
    sceneModel,
    dataModel
  }, {
    localOrigin: origin
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The view was created with an explicit local camera derived from the model's
  // coordinate-system origin, so no post-load fit is needed.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);

  Object.assign(window, {cityGMLBuildingExample: {scene, data, viewer, view, renderer, picker, inputController, sceneModel, dataModel}});
}

function localPosition(worldPosition: [number, number, number], origin: [number, number, number]) {
  return [
    worldPosition[0] - origin[0],
    worldPosition[1] - origin[1],
    worldPosition[2] - origin[2]
  ] as [number, number, number];
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
