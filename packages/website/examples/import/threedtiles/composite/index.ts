import {ThreeDTilesLoader} from "@xeokit/sdk/formats/threedtiles";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const TILESET_URL = "../../../../models/ThreeDTilesExamples/Composite/tileset.json";
const BASE_URI = "../../../../models/ThreeDTilesExamples/Composite/";
const TILESET_COORDINATE_SYSTEM = {basis: [1, 0, 0, 0, 0, 1, 0, 1, 0], origin: [0, 0, 0], units: "meters", scaleToMeters: 1};

main().catch((error) => failExample("threedtiles-composite", error));

async function main() {
  // Create the scene graph, initial camera, renderer, and navigation explicitly.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({id: "demoView", htmlElement: mustElement("demoCanvas"), camera: {eye: [40, -34, 24], look: [-3.4, 8, 5], up: [0, 0, 1]}}));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {pick: (_view, pickParams) => {
    const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
    return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
  }});

  // 3D Tiles loading starts from tileset.json. Tile coordinates are already
  // Z-up; the loader rotates only embedded glTF payloads from Y-up into tile
  // space, so the SceneModel uses the viewer's Z-up coordinate system directly.
  // The baseUri tells the loader how to resolve relative tile payload URIs.
  setStatus("status", "Loading composite 3D Tiles...");
  const fileData = await fetchJSON(TILESET_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "composite3DTiles",
    coordinateSystem: TILESET_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const loadResult = await new ThreeDTilesLoader().load({fileData, sceneModel}, {
    baseUri: new URL(BASE_URI, window.location.href).toString()
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // The initial camera is already arranged for this model.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.threeDTilesCompositeExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") return new WebGLRenderer({viewer});
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
