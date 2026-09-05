import {ThreeDTilesLoader} from "@xeokit/sdk/formats/threedtiles";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const TILESET_URL = "../../../../models/ThreeDTilesExamples/FeatureIdAttributeAndPropertyTable/tileset.json";
const BASE_URI = "../../../../models/ThreeDTilesExamples/FeatureIdAttributeAndPropertyTable/";
const TILESET_COORDINATE_SYSTEM = {basis: [1, 0, 0, 0, 0, 1, 0, 1, 0], origin: [0, 0, 0], units: "meters", scaleToMeters: 1};

main().catch((error) => failExample("threedtiles-feature-metadata", error));

async function main() {
  // DataModel is needed because this example reads feature metadata and property
  // tables after ThreeDTilesLoader has decoded the tile payloads.
  const data = new Data();
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({id: "demoView", htmlElement: mustElement("demoCanvas"), camera: {eye: [5.8, -6.8, 4.1], look: [0, -0.15, 1.35], up: [0, 0, 1]}}));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {pick: (_view, pickParams) => {
    const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
    return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
  }});

  // Fetch tileset.json and pass a baseUri so relative GLB/metadata payload URIs
  // inside the tileset resolve correctly. Tile coordinates are Z-up; embedded
  // glTF payloads are rotated into that tile space by ThreeDTilesLoader.
  setStatus("status", "Loading feature-metadata 3D Tiles...");
  const fileData = await fetchJSON(TILESET_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "featureMetadata3DTiles",
    coordinateSystem: TILESET_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: "featureMetadata3DTiles"}));
  const loadResult = await new ThreeDTilesLoader().load({fileData, sceneModel, dataModel}, {
    baseUri: new URL(BASE_URI, window.location.href).toString()
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // Filter the semantic DataModel for the example class, then wire the list to
  // View style-bin updates so feature selection is visible.
  const featureObjects = Object.values(dataModel.objects).filter((object: any) => object.type === "exampleMetadataClass");
  document.getElementById("featureCount")?.replaceChildren(String(featureObjects.length));
  document.getElementById("objectCount")?.replaceChildren(String(featureObjects.filter((object: any) => sceneModel.objects[object.id]).length));
  document.getElementById("tableCount")?.replaceChildren(String(Object.keys(dataModel.propertySets).length));
  const list = document.getElementById("featureList");
  if (list) {
    list.innerHTML = featureObjects.map((object: any) => `<button type="button" data-id="${object.id}">${object.id}</button>`).join("");
    list.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest("button");
      const id = button?.getAttribute("data-id");
      if (!id) {
        return;
      }
      view.setObjectsInStyleBin("highlighted", view.objectIds, false);
      view.setObjectsInStyleBin("highlighted", [id], true);
      const props = dataModel.propertySets[`${id}-props`]?.properties || [];
      const details = document.getElementById("details");
      if (details) {
        details.textContent = JSON.stringify({id, properties: props}, null, 2);
      }
    });
  }
  setStatus("status", `Loaded ${featureObjects.length} feature metadata objects.`);
  finishExample(renderer, view);
  window.threeDTilesFeatureMetadataExample = {scene, viewer, view, renderer, picker, inputController, data, sceneModel, dataModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") return new WebGLRenderer({viewer});
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
