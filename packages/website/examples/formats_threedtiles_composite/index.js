import * as xeokit from "../../js/xeokit-studio-bundle.js";

const TILESET_PATH = "../../models/ThreeDTilesExamples/Composite/tileset.json";
const BASE_PATH = "../../models/ThreeDTilesExamples/Composite/";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {
  const {scene} = studio;
  const view = studio.viewManager.createView({
    camera: {eye: [7, -8, 6], look: [0, 0, 1.4], up: [0, 0, 1]},
  });

  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading mixed CMPT tile...");

    const tilesetUrl = new URL(TILESET_PATH, window.location.href);
    const tileset = await (await fetch(tilesetUrl)).json();
    const sceneModel = scene.createModel({id: "composite3DTiles"}).value;
    const baseUri = new URL(BASE_PATH, window.location.href).toString();

    await new xeokit.formats.threedtiles.ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel},
      {baseUri},
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) studio.viewManager.fitToAabb(view, aabb);

    setStatus(`CMPT loaded — ${Object.keys(sceneModel.objects).length} nested objects from mixed content.`);
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load CMPT 3D Tiles: ${err.message || err}`);
    console.error(err);
  }
});
