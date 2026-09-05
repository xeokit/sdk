// Streams a BIM 3D Tiles tileset by screen-space error (SSE) with TilesetStreamer.
//
// The tileset is an explicit REPLACE level-of-detail hierarchy over a building
// model: a coarse single-building overview tile that refines, as the camera
// approaches, into a denser four-building site. The streamer loads each
// selected tile into its own SceneModel and unloads the coarser ones once the
// loaded-tile budget is exceeded — the AECO/site-streaming pattern used for
// large federated models.
import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

const TILESET_PATH = "../../../../../models/BuildingSite/threedtiles/tileset.json";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const view = studio.viewManager.createView({
    // Oblique view (up must not be parallel to the eye→look axis).
    camera: {eye: [50, -50, 40], look: [0, 0, 0], up: [0, 0, 1]},
  });

  const statusEl = document.getElementById("status");
  const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };

  try {
    setStatus("Loading tileset.json…");

    const tilesetUrl = new URL(TILESET_PATH, window.location.href);
    const tileset = await (await fetch(tilesetUrl)).json();
    const baseUri = new URL("../../../../../models/BuildingSite/threedtiles/", window.location.href).toString();

    const {buildTileTree, TilesetStreamer} = xeokit.formats.threedtiles;
    const tree = buildTileTree(tileset, baseUri);

    const streamer = new TilesetStreamer({
      scene: studio.scene,
      tree,
      maxScreenSpaceError: 16,
      maxLoadedTiles: 4,
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
          setStatus(`BIM streaming — ${streamer.loadedCount} tile(s) loaded. Zoom in: the overview refines into the building site; zoom out: it collapses.`);
        });
      }
    };
    events.onCameraViewMatrixUpdated.subscribe(onCamera);
    events.onCameraProjMatrixUpdated.subscribe(onCamera);

    setStatus(`BIM streaming — ${streamer.loadedCount} tile(s) loaded. Zoom in: the overview refines into the building site; zoom out: it collapses.`);
    studio.finished();

  } catch (err) {
    setStatus(`Failed to stream BIM 3D Tiles: ${err.message || err}`);
    console.error(err);
  }
});
