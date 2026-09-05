import {buildTileTree, streamTilesetInView} from "@xeokit/sdk/formats/threedtiles";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, mustElement, mustOk, toNavigationPick} from "../../../utils/standaloneRuntime.js";
import {signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

const TILESET_URL = "../../../../models/ProceduralCity3DTiles/threedtiles/tileset.json";
const BASE_URI = "../../../../models/ProceduralCity3DTiles/threedtiles/";
const METADATA_URL = "../../../../models/ProceduralCity3DTiles/metadata.json";
const TILESET_COORDINATE_SYSTEM = {basis: [1, 0, 0, 0, 0, 1, 0, 1, 0], origin: [0, 0, 0], units: "meters", scaleToMeters: 1};

main().catch((error) => failExample("threedtiles-procedural-city", error));

async function main() {
  // Create a lean View for a large procedural 3D Tiles city. The streamer below
  // does the progressive loading; expensive post effects are disabled.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {eye: [760, -980, 620], look: [80, 120, 58], up: [0, 0, 1]},
    effects: {
      sky: {enabled: true},
      sao: {enabled: false},
      bloom: {enabled: false},
      atmosphere: {enabled: false},
      depthOfField: {enabled: false},
      shadows: {enabled: false},
      edges: {enabled: false}
    }
  }));
  const renderer = await createRenderer(viewer);
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Connect navigation to the tiles that are currently loaded in the scene.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });
  const status = document.getElementById("status");
  const setStatus = (html: string) => {
    if (status) {
      status.innerHTML = html;
    }
  };
  setStatus("Loading procedural city 3D Tiles...");

  const [tileset, metadata] = await Promise.all([
    fetchJSON(TILESET_URL),
    fetchJSON(METADATA_URL).catch(() => null)
  ]);
  const tree = buildTileTree(tileset, new URL(BASE_URI, window.location.href).toString());
  // The streamer creates one SceneModel per loaded tile and reselects tiles on
  // camera changes. Pass the same Z-up tileset coordinate system so each
  // streamed tile is oriented consistently.
  const streamer = streamTilesetInView(view, tree, {
    coordinateSystem: TILESET_COORDINATE_SYSTEM,
    maxScreenSpaceError: 18,
    maxLoadedTiles: 36,
    concurrency: 8
  });
  // TilesetStreamer uses the current camera to decide which tiles to load; the
  // initial camera above is already positioned to request useful city tiles.
  const cameraState = () => ({
    eye: view.camera.eye,
    viewportHeight: view.boundary[3],
    fov: view.camera.perspectiveProjection.fov,
    viewMatrix: view.camera.viewMatrix,
    projMatrix: view.camera.projMatrix
  });
  const update = async () => {
    await streamer.update(cameraState());
    setStatus(`Procedural City GLB 3D Tiles: ${streamer.loadedCount} tile(s) loaded, ${metadata?.stats?.buildings || "-"} buildings.`);
  };
  await update();
  const refreshStatus = () => setStatus(`Procedural City GLB 3D Tiles: ${streamer.loadedCount} tile(s) loaded, ${metadata?.stats?.buildings || "-"} buildings.`);
  view.viewer.events.onCameraViewMatrixUpdated.subscribe((changedView) => {
    if (changedView === view) {
      refreshStatus();
    }
  });
  view.viewer.events.onCameraProjMatrixUpdated.subscribe((changedView) => {
    if (changedView === view) {
      refreshStatus();
    }
  });
  signalExampleLoadedOnNextRender(renderer, view);
  window.threeDTilesProceduralCityExample = {scene, viewer, view, renderer, picker, inputController, streamer, tileset, metadata};
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
