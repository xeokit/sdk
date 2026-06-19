// Streams an IMPLICIT 3D Tiles tileset with TilesetStreamer.
//
// Implicit tilesets carry no explicit tile hierarchy — the tree is described by
// binary `.subtree` availability files and Morton-indexed coordinates. The
// streamer fetches `.subtree` files on demand as the screen-space-error walk
// descends, derives each tile's bounding volume by subdividing the root box,
// frustum-culls tiles outside the view, and loads / unloads per-tile
// SceneModels — the Cesium-ion / Google Photorealistic streaming pattern.
//
// The sample here is the CesiumGS SparseImplicitQuadtree: a sparse quadtree
// whose content lives only at the deepest level (a flat sheet of leaf tiles),
// so it demonstrates implicit subtree streaming and frustum culling rather than
// coarse-to-fine level-of-detail. Orbit and zoom: tiles outside the view unload
// and reload, and subtrees are fetched only when the camera reaches them.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const TILESET_PATH = "../../models/SparseImplicitQuadtree/tileset.json";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const view = studio.viewManager.createView({
    // Oblique view (up must not be parallel to the eye→look axis).
    camera: {eye: [0.5, -1.2, 1.0], look: [0.5, 0.5, 0], up: [0, 0, 1]},
  });

  const statusEl = document.getElementById("status");
  const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };

  try {
    setStatus("Loading tileset.json…");

    const tilesetUrl = new URL(TILESET_PATH, window.location.href);
    const tileset = await (await fetch(tilesetUrl)).json();
    const baseUri = new URL("../../models/SparseImplicitQuadtree/", window.location.href).toString();

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

    // First pass with the initial camera, then frame what loaded. The spatial
    // index may not have the freshly-created tiles on the very next tick, so
    // retry the fit for up to ~1s until a valid scene AABB is available.
    await streamer.update(cameraState());
    let fitTries = 0;
    const fitToScene = () => {
      const aabb = studio.picking.collisionIndex.getSceneAABB();
      if (aabb && Number.isFinite(aabb[0]) && aabb[3] > aabb[0]) {
        studio.viewManager.fitToAabb(view, aabb);
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
          setStatus(`Implicit streaming — ${streamer.loadedCount} tile(s) loaded. Orbit / zoom: tiles outside the view unload and reload; subtrees fetch on demand.`);
        });
      }
    };
    events.onCameraViewMatrixUpdated.subscribe(onCamera);
    events.onCameraProjMatrixUpdated.subscribe(onCamera);

    setStatus(`Implicit streaming — ${streamer.loadedCount} tile(s) loaded. Zoom in: subtrees fetch and detail refines; zoom out: tiles unload.`);
    studio.finished();

  } catch (err) {
    setStatus(`Failed to stream implicit 3D Tiles: ${err.message || err}`);
    console.error(err);
  }
});
