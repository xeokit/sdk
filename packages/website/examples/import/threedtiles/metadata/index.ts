import {ThreeDTilesLoader} from "@xeokit/sdk/formats/threedtiles";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const TILESET_URL = "../../../../models/ProceduralCity3DTiles/threedtiles/tileset.json";
const BASE_URI = "../../../../models/ProceduralCity3DTiles/threedtiles/";
const TILESET_COORDINATE_SYSTEM = {basis: [1, 0, 0, 0, 0, 1, 0, 1, 0], origin: [0, 0, 0], units: "meters", scaleToMeters: 1};

main().catch((error) => failExample("threedtiles-metadata", error));

async function main() {
  // DataModel is needed because this example displays property-table metadata
  // decoded from the 3D Tiles content.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({id: "demoView", htmlElement: mustElement("demoCanvas"), camera: {eye: [760, -980, 620], look: [80, 120, 58], up: [0, 0, 1]}}));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {pick: (_view, pickParams) => {
    const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
    return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
  }});

  // Fetch tileset.json and pass a baseUri so relative GLB/metadata payload URIs
  // inside the tileset resolve correctly. This procedural-city tileset is
  // authored in the same Z-up frame as its model sidecar coordinate system.
  setStatus("status", "Loading 3D Tiles metadata...");
  const fileData = await fetchJSON(TILESET_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "metadata3DTiles",
    coordinateSystem: TILESET_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: "metadata3DTiles"}));
  const loadResult = await new ThreeDTilesLoader().load({fileData, sceneModel, dataModel}, {
    baseUri: new URL(BASE_URI, window.location.href).toString()
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The DataModel now contains property sets linked to loaded SceneObjects.
  const propertySetCount = Object.keys(dataModel.propertySets).length;
  document.getElementById("summary")?.replaceChildren(`${Object.keys(sceneModel.objects).length} objects, ${propertySetCount} property sets`);
  document.getElementById("details")?.replaceChildren(JSON.stringify(Object.keys(dataModel.propertySets).slice(0, 12), null, 2));
  setStatus("status", `Loaded 3D Tiles metadata: ${propertySetCount} property sets.`);
  finishExample(renderer, view);
  window.threeDTilesMetadataExample = {scene, viewer, view, renderer, picker, inputController, data, sceneModel, dataModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") return new WebGLRenderer({viewer});
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
