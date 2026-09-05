import {ThreeDTilesLoader} from "@xeokit/sdk/formats/threedtiles";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const TILESET_URL = "../../../../models/Tiles3D/threedtiles/tileset.json";
const BASE_URI = "../../../../models/Tiles3D/threedtiles/";
const TILESET_COORDINATE_SYSTEM = {basis: [1, 0, 0, 0, 0, 1, 0, 1, 0], origin: [0, 0, 0], units: "meters", scaleToMeters: 1};

main().catch((error) => failExample("threedtiles-helmets", error));

async function main() {
  // Textured helmet tiles use texturing, IBL, SAO, and ACES tonemapping.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {eye: [12, 12, 10], look: [0, 0, 0], up: [0, 0, 1]},
    texturing: {enabled: true},
    effects: {edges: {enabled: false}, sao: {enabled: true, intensity: 0.08, scale: 0.8}, tonemap: {enabled: true, mode: "aces", exposure: 0.55, sRGBEncode: true}},
    lights: {ibl: {enabled: true, intensity: 0.65}, hemispheric: {enabled: true, intensity: 0.35}}
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {pick: (_view, pickParams) => {
    const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
    return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
  }});
  // Fetch tileset.json and create the target SceneModel explicitly. Tile
  // coordinates are already Z-up; the loader rotates embedded glTF payloads
  // from Y-up into tile space before placing them with each tile transform.
  setStatus("status", "Loading helmet 3D Tiles...");
  const fileData = await fetchJSON(TILESET_URL);
  const sceneModel = mustOk(scene.createModel({
    id: "tilesScene",
    coordinateSystem: TILESET_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const loadResult = await new ThreeDTilesLoader().load({fileData, sceneModel}, {
    baseUri: new URL(BASE_URI, window.location.href).toString()
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  // Textured helmet tiles benefit from the IBL and SAO enabled above.
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
  window.threeDTilesHelmetsExample = {scene, viewer, view, renderer, picker, inputController, sceneModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") return new WebGLRenderer({viewer});
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
