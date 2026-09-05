import {ThreeDTilesLoader} from "@xeokit/sdk/formats/threedtiles";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const TILESET_URL = "../../../../models/ThreeDTilesExamples/Instancing/tileset.json";
const BASE_URI = "../../../../models/ThreeDTilesExamples/Instancing/";
const TILESET_COORDINATE_SYSTEM = {basis: [1, 0, 0, 0, 0, 1, 0, 1, 0], origin: [0, 0, 0], units: "meters", scaleToMeters: 1};

main().catch((error) => failExample("threedtiles-instancing", error));

async function main() {
  // Create the scene graph, View, renderer, and navigation before loading tiles.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({id: "demoView", htmlElement: mustElement("demoCanvas"), camera: {eye: [8, -9, 6], look: [0, 0.8, 0.8], up: [0, 0, 1]}}));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {pick: (_view, pickParams) => {
    const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
    return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
  }});
  // Fetch tileset.json and create the target SceneModel explicitly. i3dm
  // instance positions are already in Z-up tile space; embedded glTF payloads
  // are rotated into that tile space by the loader.
  setStatus("status", "Loading instanced 3D Tiles...");
  const fileData = await fetchJSON(TILESET_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "instanced3DTiles",
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
  window.threeDTilesInstancingExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") return new WebGLRenderer({viewer});
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
