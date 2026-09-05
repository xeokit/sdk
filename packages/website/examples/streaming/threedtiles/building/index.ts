// Streams a BIM 3D Tiles tileset by screen-space error (SSE) with TilesetStreamer.
//
// The tileset is an explicit REPLACE level-of-detail hierarchy over a building
// model: a coarse single-building overview tile refines into a denser
// four-building site as the camera approaches.
import {buildTileTree, TilesetStreamer} from "@xeokit/sdk/formats/threedtiles";
import {Scene} from "@xeokit/sdk/model/scene";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, fitViewToScene, mustElement, mustOk, toNavigationPick, createExampleRenderer} from "../../../utils/standaloneRuntime.js";
import {signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

const TILESET_PATH = "../../../../models/BuildingSite/threedtiles/tileset.json";
const TILESET_BASE_URI = "../../../../models/BuildingSite/threedtiles/";
const TILESET_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("streaming-threedtiles-building", error));

async function main() {
  // Create the SDK runtime explicitly: a Scene holds streamed tile models, the
  // Viewer owns Views, and the renderer is configured for the selected backend.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {eye: [50, -50, 40], look: [0, 0, 0], up: [0, 0, 1]},
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
  const renderer = await createExampleRenderer(viewer);
  const picker = new RoutingPickStrategy(scene, renderer);
  const collisionIndex = getSceneCollisionIndex(scene);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  const statusEl = document.getElementById("status");
  const setStatus = (text: string) => {
    if (statusEl) {
      statusEl.textContent = text;
    }
  };

  setStatus("Loading tileset.json...");
  const tileset = await fetchJSON(TILESET_PATH);
  const tree = buildTileTree(tileset, new URL(TILESET_BASE_URI, window.location.href).toString());
  const streamer = new TilesetStreamer({
    scene,
    tree,
    // 3D Tiles content is authored in the tileset's Z-up frame; every streamed
    // tile SceneModel receives the same conversion into xeokit's scene basis.
    coordinateSystem: TILESET_COORDINATE_SYSTEM,
    maxScreenSpaceError: 16,
    maxLoadedTiles: 4
  });

  const cameraState = () => ({
    eye: view.camera.eye,
    viewportHeight: view.boundary[3],
    fov: view.camera.perspectiveProjection.fov,
    viewMatrix: view.camera.viewMatrix,
    projMatrix: view.camera.projMatrix
  });

  await streamer.update(cameraState());
  let fitTries = 0;
  const fitToScene = () => {
    const aabb = collisionIndex.getSceneAABB();
    if (aabb && Number.isFinite(aabb[0]) && aabb[3] > aabb[0]) {
      fitViewToScene(view, {aabb});
      return;
    }
    if (fitTries++ < 20) {
      setTimeout(fitToScene, 50);
    }
  };
  fitToScene();

  const updateStatus = () => setStatus(`BIM streaming - ${streamer.loadedCount} tile(s) loaded. Zoom in to refine the overview into the building site; zoom out to collapse it.`);
  const onCamera = (changedView) => {
    if (changedView === view) {
      streamer.update(cameraState()).then(updateStatus);
    }
  };
  viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);

  updateStatus();
  signalExampleLoadedOnNextRender(renderer, view);
  window.threeDTilesBuildingStreamingExample = {scene, viewer, view, renderer, picker, inputController, streamer, tileset};
}
