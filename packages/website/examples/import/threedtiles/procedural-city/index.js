// Streams a generated procedural city exported as explicit 3D Tiles 1.1
// with GLB tile payloads. The dataset has one root GLB, 59 spatial GLB tiles,
// 1,800 generated buildings, about 494k triangles, and about 31 MB of content.
//
// Tile selection is camera-driven. TilesetStreamer first rejects tiles whose
// spatial bounding volumes fall outside the camera frustum, then selects visible
// tiles by screen-space error. SSE estimates each tile's projected size on the
// canvas from its geometric error, camera distance, field of view, and viewport
// height.
//
// A selected tile is fetched as GLB and decoded into its own SceneModel. When a
// tile leaves the selected set, for example because it moves out of view or the
// loaded-tile budget is exceeded, that SceneModel is destroyed. That eviction
// removes the tile's scene objects and releases the SDK/renderer resources
// owned by that per-tile model instead of keeping all tile models resident. The
// example also performs an object-level projected-size cull after each stream
// update: streamed SceneObjects whose world AABBs occupy too few canvas pixels
// are marked culled for this View. This hides tiny objects without evicting
// their tile model from memory.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const TILESET_PATH = "../../../../models/ProceduralCity3DTiles/threedtiles/tileset.json";
const BASE_PATH = "../../../../models/ProceduralCity3DTiles/threedtiles/";
const METADATA_PATH = "../../../../models/ProceduralCity3DTiles/metadata.json";
const OBJECT_CULL_HIDE_PX = 18;
const OBJECT_CULL_SHOW_PX = 24;

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const view = studio.viewManager.createView({
    camera: {eye: [760, -980, 620], look: [80, 120, 58], up: [0, 0, 1]},
    adaptiveQuality: false,
    effects: {
      sao: {enabled: false},
      bloom: {enabled: false},
      atmosphere: {enabled: false},
      depthOfField: {enabled: false},
      tonemap: {enabled: false},
      antiAliasing: {enabled: false},
      shadows: {enabled: false},
      edges: {enabled: false},
      sky: {
        enabled: true,
        skyColor: [0.48, 0.68, 0.84],
        horizonColor: [0.82, 0.91, 0.95],
        groundColor: [0.72, 0.78, 0.72],
        blend: 0.5,
        intensity: 0.85
      },
      sectionPlaneCaps: {enabled: false},
      bodyHatch: {enabled: false}
    },
    lights: {
      ibl: {enabled: false},
      hemispheric: {enabled: true}
    }
  });
  studio.viewProfiles?.setActiveProfile(null);
  disableExpensiveEffects(view);
  enableSky(view);

  const statusEl = document.getElementById("status");
  const setStatus = (html) => { if (statusEl) statusEl.innerHTML = html; };

  try {
    setStatus("Loading procedural city 3D Tiles...");

    const tilesetUrl = new URL(TILESET_PATH, window.location.href);
    const metadataUrl = new URL(METADATA_PATH, window.location.href);
    const [tileset, metadata] = await Promise.all([
      fetch(tilesetUrl).then((response) => response.json()),
      fetch(metadataUrl).then((response) => response.ok ? response.json() : null).catch(() => null),
    ]);
    const baseUri = new URL(BASE_PATH, window.location.href).toString();

    const {buildTileTree, TilesetStreamer} = xeokit.formats.threedtiles;
    const tree = buildTileTree(tileset, baseUri);

    const streamer = new TilesetStreamer({
      scene: studio.scene,
      tree,
      maxScreenSpaceError: 18,
      maxLoadedTiles: 36,
      concurrency: 8,
    });

    window.xeokitExample = {studio, view, streamer, tileset, metadata};

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
      const stats = metadata?.stats || {};
      setStatus(
        `<strong>Procedural City GLB 3D Tiles</strong> — ${streamer.loadedCount} tile(s) loaded. ` +
        `${stats.buildings || tileset.root?.metadata?.properties?.buildingCount || "-"} buildings, ` +
        `${tileset.root?.metadata?.properties?.tileCount || "-"} grid tiles, ` +
        `${Math.round((stats.triangles || 0) / 1000)}k triangles, 31 MB dataset.` +
        `<span class="streamInfo">Tiles outside the camera frustum are culled by spatial bounding volume; visible tiles are selected by screen-space error, estimating each tile's projected size on the canvas from camera distance, FOV, and viewport height. ${cullStats.hidden}/${cullStats.considered} streamed object(s) are currently culled below ${OBJECT_CULL_HIDE_PX}px projected canvas size.</span>`
      );
    };

    await streamer.update(cameraState());
    updateStatus();

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

    const events = studio.viewer.events;
    const onCamera = (changedView) => {
      if (changedView !== view) {
        return;
      }
      streamer.update(cameraState()).then(updateStatus);
    };
    events.onCameraViewMatrixUpdated.subscribe(onCamera);
    events.onCameraProjMatrixUpdated.subscribe(onCamera);

    studio.finished();

  } catch (err) {
    setStatus(`Failed to stream procedural city 3D Tiles: ${err.message || err}`);
    console.error(err);
  }
});

function disableExpensiveEffects(view) {
  const effects = view.effects || {};
  for (const effectId of [
    "sao",
    "bloom",
    "atmosphere",
    "depthOfField",
    "tonemap",
    "antiAliasing",
    "shadows",
    "edges",
    "sectionPlaneCaps",
    "bodyHatch"
  ]) {
    if (effects[effectId]) {
      effects[effectId].enabled = false;
    }
  }
  if (view.lights?.ibl) {
    view.lights.ibl.enabled = false;
  }
}

function enableSky(view) {
  const sky = view.effects?.sky;
  if (!sky) {
    return;
  }
  sky.enabled = true;
  sky.skyColor = [0.48, 0.68, 0.84];
  sky.horizonColor = [0.82, 0.91, 0.95];
  sky.groundColor = [0.72, 0.78, 0.72];
  sky.blend = 0.5;
  sky.intensity = 0.85;
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
