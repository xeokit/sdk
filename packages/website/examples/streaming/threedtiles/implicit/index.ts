// Streams a generated procedural city as an implicit 3D Tiles quadtree with
// TilesetStreamer. Implicit tilesets describe the hierarchy with `.subtree`
// availability files and templated content URIs.
import {buildTileTree, TilesetStreamer} from "@xeokit/sdk/formats/threedtiles";
import {Scene} from "@xeokit/sdk/model/scene";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchJSON, fitViewToScene, mustElement, mustOk, toNavigationPick, createExampleRenderer} from "../../../utils/standaloneRuntime.js";
import {signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

const TILESET_PATH = "../../../../models/ProceduralCity3DTiles/implicit/tileset.json";
const TILESET_BASE_URI = "../../../../models/ProceduralCity3DTiles/implicit/";
const TILESET_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};
const OBJECT_CULL_HIDE_PX = 18;
const OBJECT_CULL_SHOW_PX = 24;

main().catch((error) => failExample("streaming-threedtiles-implicit", error));

async function main() {
  // The View is deliberately lean for streaming: no heavy post effects, with sky
  // and grid enabled by the shared renderer utility for spatial orientation.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
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
    // Every GLB tile is loaded into its own SceneModel; keep the Z-up tileset
    // coordinate system explicit at that boundary.
    coordinateSystem: TILESET_COORDINATE_SYSTEM,
    maxScreenSpaceError: 16,
    maxLoadedTiles: 64
  });

  const cameraState = () => ({
    eye: view.camera.eye,
    viewportHeight: view.boundary[3],
    fov: view.camera.perspectiveProjection.fov,
    viewMatrix: view.camera.viewMatrix,
    projMatrix: view.camera.projMatrix
  });
  const objectCanvasCullState = new Map();
  const applyObjectCanvasCulling = () => {
    let considered = 0;
    let hidden = 0;
    const boundary = view.boundary;
    const viewportWidth = boundary[2];
    const viewportHeight = boundary[3];
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return {considered, hidden};
    }
    for (const objectId in view.objects) {
      const viewObject = view.objects[objectId];
      const sceneObject = viewObject.sceneObject;
      if (!sceneObject || !sceneObject.model.id.startsWith("tilestream-")) {
        continue;
      }
      considered++;
      const aabb = collisionIndex.getObjectAABB(objectId);
      if (!aabb) {
        viewObject.culled = false;
        objectCanvasCullState.delete(objectId);
        continue;
      }
      const size = projectedAABBPixelSize(aabb, view.camera.viewMatrix, view.camera.projMatrix, viewportWidth, viewportHeight);
      const wasHidden = objectCanvasCullState.get(objectId) === true;
      const shouldHide = wasHidden ? size < OBJECT_CULL_SHOW_PX : size < OBJECT_CULL_HIDE_PX;
      objectCanvasCullState.set(objectId, shouldHide);
      viewObject.culled = shouldHide;
      if (shouldHide) {
        hidden++;
      }
    }
    for (const objectId of [...objectCanvasCullState.keys()]) {
      if (!view.objects[objectId]) {
        objectCanvasCullState.delete(objectId);
      }
    }
    return {considered, hidden};
  };

  const updateStatus = (cullStats = applyObjectCanvasCulling()) => {
    setStatus(`Implicit city streaming - ${streamer.loadedCount} tile(s) loaded, ${cullStats.hidden}/${cullStats.considered} object(s) hidden below ${OBJECT_CULL_HIDE_PX}px.`);
  };

  await streamer.update(cameraState());
  applyObjectCanvasCulling();
  let fitTries = 0;
  const fitToScene = () => {
    const aabb = collisionIndex.getSceneAABB();
    if (aabb && Number.isFinite(aabb[0]) && aabb[3] > aabb[0]) {
      fitViewToScene(view, {aabb});
      requestAnimationFrame(() => updateStatus());
      return;
    }
    if (fitTries++ < 20) {
      setTimeout(fitToScene, 50);
    }
  };
  fitToScene();

  const onCamera = (changedView) => {
    if (changedView === view) {
      streamer.update(cameraState()).then(() => updateStatus());
    }
  };
  viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);

  updateStatus();
  signalExampleLoadedOnNextRender(renderer, view);
  window.threeDTilesImplicitStreamingExample = {scene, viewer, view, renderer, picker, inputController, streamer, tileset};
}

function projectedAABBPixelSize(aabb, viewMatrix, projMatrix, viewportWidth, viewportHeight) {
  const corners = [
    [aabb[0], aabb[1], aabb[2]],
    [aabb[3], aabb[1], aabb[2]],
    [aabb[0], aabb[4], aabb[2]],
    [aabb[3], aabb[4], aabb[2]],
    [aabb[0], aabb[1], aabb[5]],
    [aabb[3], aabb[1], aabb[5]],
    [aabb[0], aabb[4], aabb[5]],
    [aabb[3], aabb[4], aabb[5]]
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let projected = 0;
  for (const corner of corners) {
    const viewPos = transformPoint(viewMatrix, corner);
    const clip = transformPoint4(projMatrix, viewPos);
    const w = clip[3];
    if (w <= 0.00001) {
      continue;
    }
    const ndcX = clip[0] / w;
    const ndcY = clip[1] / w;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) {
      continue;
    }
    const x = (ndcX * 0.5 + 0.5) * viewportWidth;
    const y = (1 - (ndcY * 0.5 + 0.5)) * viewportHeight;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    projected++;
  }
  return projected === 0 ? 0 : Math.max(maxX - minX, maxY - minY);
}

function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14]
  ];
}

function transformPoint4(m, p) {
  const x = p[0], y = p[1], z = p[2];
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15]
  ];
}
