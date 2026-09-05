// Streams a generated procedural city as an implicit 3D Tiles quadtree with
// TilesetStreamer.
//
// Implicit tilesets carry no explicit tile hierarchy — the tree is described by
// binary `.subtree` availability files and Morton-indexed coordinates. The
// streamer fetches `.subtree` files on demand as the screen-space-error walk
// descends, derives each tile's bounding volume by subdividing the root box,
// frustum-culls tiles outside the view, and loads / unloads per-tile
// SceneModels — the Cesium-ion / Google Photorealistic streaming pattern.
//
// The sample maps generated city GLB tiles onto an implicit quadtree. Content
// lives on the deepest available city cells, while the subtree file describes
// which cells exist. Orbit and zoom: tiles outside the view unload and reload,
// and the subtree is fetched through the implicit-tiling path before templated
// GLB content URIs are resolved. The example also performs a second,
// object-level cull in view space: after tiles are loaded, each streamed
// SceneObject's world AABB is projected into the canvas and culled when it is
// too small to contribute useful pixels. This does not evict the object from
// memory; it only toggles that ViewObject's culling flag for this View.
import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

const TILESET_PATH = "../../../../../models/ProceduralCity3DTiles/implicit/tileset.json";
const OBJECT_CULL_HIDE_PX = 18;
const OBJECT_CULL_SHOW_PX = 24;

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const view = studio.viewManager.createView({
    // Oblique view (up must not be parallel to the eye→look axis).
    camera: {eye: [760, -980, 620], look: [80, 120, 58], up: [0, 0, 1]},
  });

  const statusEl = document.getElementById("status");
  const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };

  try {
    setStatus("Loading tileset.json…");

    const tilesetUrl = new URL(TILESET_PATH, window.location.href);
    const tileset = await (await fetch(tilesetUrl)).json();
    const baseUri = new URL("../../../../../models/ProceduralCity3DTiles/implicit/", window.location.href).toString();

    const {buildTileTree, TilesetStreamer} = xeokit.formats.threedtiles;
    const tree = buildTileTree(tileset, baseUri);

    const streamer = new TilesetStreamer({
      scene: studio.scene,
      tree,
      maxScreenSpaceError: 16,
      maxLoadedTiles: 64,
    });

    const cameraState = () => ({
      eye: view.camera.eye,
      viewportHeight: view.boundary[3],
      fov: view.camera.perspectiveProjection.fov,
      viewMatrix: view.camera.viewMatrix,
      projMatrix: view.camera.projMatrix,
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
        const aabb = studio.picking.collisionIndex.getObjectAABB(objectId);
        if (!aabb) {
          viewObject.culled = false;
          objectCanvasCullState.delete(objectId);
          continue;
        }
        const size = projectedAABBPixelSize(
          aabb,
          view.camera.viewMatrix,
          view.camera.projMatrix,
          viewportWidth,
          viewportHeight,
        );
        const wasHidden = objectCanvasCullState.get(objectId) === true;
        const shouldHide = wasHidden ? size < OBJECT_CULL_SHOW_PX : size < OBJECT_CULL_HIDE_PX;
        objectCanvasCullState.set(objectId, shouldHide);
        if (viewObject.culled !== shouldHide) {
          viewObject.culled = shouldHide;
        }
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
      setStatus(`Implicit city streaming — ${streamer.loadedCount} tile(s) loaded, ${cullStats.hidden}/${cullStats.considered} object(s) hidden below ${OBJECT_CULL_HIDE_PX}px. The quadtree culls by bounds, refines by screen-space error, and resolves templated GLB content at selected cells.`);
    };

    // First pass with the initial camera, then frame what loaded. The spatial
    // index may not have the freshly-created tiles on the very next tick, so
    // retry the fit for up to ~1s until a valid scene AABB is available.
    await streamer.update(cameraState());
    applyObjectCanvasCulling();
    let fitTries = 0;
    const fitToScene = () => {
      const aabb = studio.picking.collisionIndex.getSceneAABB();
      if (aabb && Number.isFinite(aabb[0]) && aabb[3] > aabb[0]) {
        studio.viewManager.fitToAabb(view, aabb);
        requestAnimationFrame(() => updateStatus());
        return;
      }
      if (fitTries++ < 20) setTimeout(fitToScene, 50);
    };
    fitToScene();

    // Re-stream on every camera change for this View.
    const events = studio.viewer.events;
    const onCamera = (changedView) => {
      if (changedView === view) {
        streamer.update(cameraState()).then(() => {
          updateStatus();
        });
      }
    };
    events.onCameraViewMatrixUpdated.subscribe(onCamera);
    events.onCameraProjMatrixUpdated.subscribe(onCamera);

    updateStatus();
    studio.finished();

  } catch (err) {
    setStatus(`Failed to stream implicit procedural city 3D Tiles: ${err.message || err}`);
    console.error(err);
  }
});

function projectedAABBPixelSize(aabb, viewMatrix, projMatrix, viewportWidth, viewportHeight) {
  const corners = [
    [aabb[0], aabb[1], aabb[2]],
    [aabb[3], aabb[1], aabb[2]],
    [aabb[0], aabb[4], aabb[2]],
    [aabb[3], aabb[4], aabb[2]],
    [aabb[0], aabb[1], aabb[5]],
    [aabb[3], aabb[1], aabb[5]],
    [aabb[0], aabb[4], aabb[5]],
    [aabb[3], aabb[4], aabb[5]],
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

  if (projected === 0) {
    return 0;
  }
  return Math.max(maxX - minX, maxY - minY);
}

function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function transformPoint4(m, p) {
  const x = p[0], y = p[1], z = p[2];
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}
