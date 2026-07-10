// Import the xeokit SDK bundle, plus the procedural archipelago generator.
import * as xeokit from "../../js/xeokit-studio-bundle.js";
import { buildArchipelago } from "./archipelago.js";
import { placeBuildings } from "./buildings.js";

// =============================================================================
// Double-precision archipelago
//
// An archipelago of 54 rocky islands, three buildings, and a ferry, geo-located
// at a real-world UTM Zone 32N origin (~267 km easting, ~6 550 km northing, off
// the Norwegian coast). Every geometry vertex stays within float32-safe metres
// of the SceneModel origin, which alone carries the large double-precision world
// coordinate — so the renderer holds the whole 56 km scene jitter-free while the
// camera can still orbit a window mullion at sub-millimetre precision.
//
// The island/rock/ocean proc-gen lives in archipelago.js; this file focuses on
// the double-precision setup and placing the loaded building models.
// =============================================================================

const UTM_EAST  = 267_000.0;
const UTM_NORTH = 6_550_000.0;

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  // The archipelago SceneModel carries the large UTM origin as a double-
  // precision value; all of its geometry is authored in small local metres.
  const sceneModelResult = scene.createModel({
    id: "archipelago",
    coordinateSystem: {
      // Basis is [Right, Up, Forward]. The terrain is authored Z-up, so this
      // maps (east, height, north) to match the Scene's Z-up world.
      basis:  [1, 0, 0,   0, 0, 1,   0, 1, 0],  // Z-up, X=east, Y=north
      origin: [UTM_EAST, 0.0, UTM_NORTH],
      units:  "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
  const model = sceneModelResult.value;

  // Build the islands, rocks, and ocean into the SceneModel. Returns the
  // boulder anchors the two buildings sit on, plus the sea level the ferry
  // floats at.
  const { duplexAnchor, houseAnchor, SEA_LEVEL } =
    await buildArchipelago(xeokit, model, xeokit.base.utils.yieldToHost);

  // Load and place the buildings + ferry, with the stone foundations the
  // two buildings rest on.
  await placeBuildings(xeokit, studio, model, {
    UTM_EAST, UTM_NORTH, duplexAnchor, houseAnchor, SEA_LEVEL,
  });

  // Camera — elevated SSW view framing the full ~56 km world. eye / look are in
  // world coordinates, carrying the same UTM offset as the SceneModel origin.
  const view = studio.viewManager.createView({
    camera: {
      // World is Z-up: (X, Y, Z) = (east, north, height).
      eye:  [UTM_EAST + 4000, UTM_NORTH - 28000, 13000],
      look: [UTM_EAST +  400, UTM_NORTH +  3000,    60],
      up:   [0, 0, 1],
      perspectiveProjection: { near: 0.001, far: 200000 }
    }
  });

  // Info panel — overrides the JSON-fetched description so the
  // closing paragraph carries two clickable links: one flies the
  // camera to the Duplex, the other to the Ferry. The description
  // block is rendered as raw HTML (the override path skips the
  // panel's default escape), so the <a> tags survive intact.
  const linkStyle = "color:#1f6feb;text-decoration:underline;cursor:pointer";
  const infoDescription = `
    <p>An archipelago of 54 rocky islands spread across a 56 km
    expanse of ocean, geo-located at real-world UTM Zone 32N
    coordinates: ~267 km easting, 6.55 million metres northing —
    off the Norwegian coast, ~50 km west of Stavanger. Three
    buildings inhabit the scene: a Duplex on the central island,
    an IfcOpenHouse4 on the far NW island, and a Ferry afloat
    ~12 km southeast.</p>
    <p>A scene this large is normally a precision nightmare. At
    6.55 million metres from world origin, single-precision floats
    resolve only to about 30 cm — enough that cliff faces would
    visibly jitter as the camera moves and surface picks would
    miss by metres. xeokit holds every world coordinate as a true
    double-precision value while keeping per-vertex geometry
    float32-safe, and resolves the two at render time, so the
    camera can orbit a window mullion at sub-millimetre precision
    inside the same scene that hosts the entire archipelago.</p>
    <p>
      <a href="#" data-action="fly-duplex" style="${linkStyle}">Fly to the Duplex →</a>
      &nbsp;·&nbsp;
      <a href="#" data-action="fly-house"  style="${linkStyle}">Fly to the House →</a>
      &nbsp;·&nbsp;
      <a href="#" data-action="fly-ferry"  style="${linkStyle}">Fly to the Ferry →</a>
    </p>`;
  const info = await studio.openInfoPanelFromMeta({ description: infoDescription });

  // Aggregate a SceneModel's world-space AABB by unioning each of its
  // SceneObjects' AABBs via the picking collision index. That's the
  // same source CameraFlight reads when framing arbitrary AABBs, so
  // the fit math stays consistent across other framing paths.
  const flyToModel = (modelId, duration = 1.8) => {
    const model = scene.models[modelId];
    if (!model) return;
    const ci = studio.picking.collisionIndex;
    let minX =  Infinity, minY =  Infinity, minZ =  Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const objId of Object.keys(model.objects)) {
      const a = ci.getObjectAABB(objId);
      if (!a) continue;
      if (a[0] < minX) minX = a[0];
      if (a[1] < minY) minY = a[1];
      if (a[2] < minZ) minZ = a[2];
      if (a[3] > maxX) maxX = a[3];
      if (a[4] > maxY) maxY = a[4];
      if (a[5] > maxZ) maxZ = a[5];
    }
    if (!isFinite(minX)) return;
    studio.viewManager.views[view.id].cameraFlight.flyTo({
      aabb: [minX, minY, minZ, maxX, maxY, maxZ],
      fitFOV: 45,
      duration,
      // Pull the camera up into a parabolic arc at the flight's
      // midpoint so transitions across the archipelago (Duplex →
      // House → Ferry) read as actual traversals over the landscape
      // rather than teleports. CameraFlightAnimation picks up `arc`
      // and auto-sizes the apex to ¼ of the eye-to-eye distance.
      // The "inThenOut" easing curve gives a slow → fast → slow
      // cadence: gentle takeoff, fast traversal across the middle
      // of the archipelago, gentle arrival — pairs naturally with
      // the parabolic `arc` so the apex reads as a glide.
      arc: true,
      easing: "inThenOut"
    });
  };

  document.querySelector('a[data-action="fly-duplex"]')
    ?.addEventListener("click", (e) => { e.preventDefault(); flyToModel("duplex"); });
  document.querySelector('a[data-action="fly-house"]')
    ?.addEventListener("click", (e) => { e.preventDefault(); flyToModel("house"); });
  document.querySelector('a[data-action="fly-ferry"]')
    ?.addEventListener("click", (e) => { e.preventDefault(); flyToModel("ferry"); });

  // ── FPS + frame-time meter ──────────────────────────────────────
  // Measures per-frame timing with requestAnimationFrame +
  // performance.now() (the SDK's onTick event isn't dispatched, so
  // playCameraTour takes the same rAF approach). Both readouts are
  // running (exponential moving) averages, so they're smooth instead
  // of flickering. Caveat: rAF is VSync-gated, so while the GPU keeps
  // up, FPS pins at ~60 and ms pins at ~16.7; the numbers only diverge
  // once the scene is genuinely GPU-bound (below 60).
  info.addStat({ id: "fps", label: "FPS" });
  info.addStat({ id: "ms",  label: "Frame ms" });
  const SMOOTHING = 0.1;   // weight of each new frame in the average
  let fpsAvg = 0;
  let msAvg = 0;
  let fpsLast = performance.now();
  let fpsShown = -1;
  let msShown = "";
  const fpsTick = () => {
    if (view.destroyed) return;
    const now = performance.now();
    const dt = now - fpsLast;
    fpsLast = now;
    if (dt > 0) {
      const instant = 1000 / dt;
      fpsAvg = fpsAvg === 0 ? instant : fpsAvg + SMOOTHING * (instant - fpsAvg);
      msAvg  = msAvg  === 0 ? dt      : msAvg  + SMOOTHING * (dt - msAvg);
      const rounded = Math.round(fpsAvg);
      if (rounded !== fpsShown) {
        fpsShown = rounded;
        info.setStat("fps", String(rounded));
      }
      const msText = msAvg.toFixed(1);
      if (msText !== msShown) {
        msShown = msText;
        info.setStat("ms", msText);
      }
    }
    requestAnimationFrame(fpsTick);
  };
  requestAnimationFrame(fpsTick);

  studio.finished();
});
