// Loads and views a 3D Tiles tileset via ThreeDTilesLoader.
//
// The tileset is a 2x2 grid of four tiles, each referencing the same Y-up glTF
// model placed by the tile's `transform`. The loader traverses tileset.json,
// fetches each tile's content relative to baseUri, applies the Y-up→Z-up
// rotation that 3D Tiles content uses, and bakes each tile transform into the
// per-mesh matrices of one SceneModel.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const TILESET_PATH = "../../../../models/Tiles3D/threedtiles/tileset.json";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [12, 12, 10],
      look: [0, 0, 0],
      up:   [0, 0, 1]
    }
  });

  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading 3D Tiles…");

    const tilesetUrl = new URL(TILESET_PATH, window.location.href);
    const resp = await fetch(tilesetUrl);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${TILESET_PATH} (HTTP ${resp.status})`);
    }
    const tileset = await resp.json();

    const sceneModelResult = scene.createModel({ id: "tilesScene" });
    if (!sceneModelResult.ok) {
      throw new Error(sceneModelResult.error);
    }
    const sceneModel = sceneModelResult.value;

    // baseUri must be absolute so the loader can resolve each tile's content
    // URI; it is the directory tileset.json was fetched from.
    const baseUri = new URL("../../../../models/Tiles3D/threedtiles/", window.location.href).toString();

    await new xeokit.formats.threedtiles.ThreeDTilesLoader().load(
      { fileData: tileset, sceneModel },
      { baseUri },
    );

    console.log(
      `[3dtiles] loaded ${Object.keys(sceneModel.objects).length} tiles / ` +
      `${Object.keys(sceneModel.geometries).length} geometries / ` +
      `${Object.keys(sceneModel.meshes).length} meshes`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) {
      studio.viewManager.fitToAabb(view, aabb);
    }

    if (status) status.style.display = "none";
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load 3D Tiles: ${err.message || err}`);
    console.error(err);
  }
});
