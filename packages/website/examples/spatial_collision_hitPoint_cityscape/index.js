// Stress-tests SceneCollisionIndex's BVH and the triangle-precise raycaster
// against a procedurally generated city of ~65 000 buildings plus a
// downtown skyline of iconic-style multi-mesh landmarks: Space Needle,
// CN Tower, Burj-style sail, art-deco stepped tower, twin-towers-and-
// sky-bridge, drum + dome. Each landmark is a single SceneObject made of
// 3–7 SceneMeshes mixing boxes, cylinders, tapered cylinders, and
// spheres, so picking exercises every primitive type plus multi-mesh
// candidate ordering inside the BVH.
//
// Three design points worth flagging up front:
//
//   1. The picking cursor is a plain HTML <div> layered over the canvas via
//      CSS transform. Each mousemove only writes that transform — no
//      `mesh.matrix = ...`, no `view.objects[id].visible = ...`, no scene
//      mutation. The 3D pipeline never re-renders just because the mouse
//      moved. Color toggles via a CSS class on hit/miss.
//
//   2. The hit ray and hit point line up with the cursor for free: the ray
//      is cast through the cursor pixel, so any point on it projects back
//      to the same pixel. We position the HTML cursor at e.clientX/Y
//      directly — there's no need to project hit.worldPos back to canvas.
//
//   3. `renderer.pick` is wrapped at startup with a counter and a benign
//      no-op return. Any code path that *would* perform a GPU-framebuffer
//      pick increments the HUD's "GPU picks" counter, which stays green at
//      zero and turns red on the first call. Demonstrates that the example
//      is fully CPU-side.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene, renderer } = studio;

  // ---------------------------------------------------------------------
  // GPU-pick spy
  //
  // The whole point of this example is BVH+triangle picking on the CPU,
  // not GPU-pick framebuffer round-trips. Wrap renderer.pick so any call
  // is counted and reported in the HUD, then return a benign "miss" so
  // anything that *did* try to GPU-pick (e.g. ViewController internals)
  // doesn't crash — it just gets nothing back.
  //
  // If the counter ever leaves zero during interaction, it means
  // something on the demo path is still going through the framebuffer
  // pick. Visible in the HUD; no need to inspect the network panel or
  // shader logs.
  // ---------------------------------------------------------------------
  let gpuPickCalls = 0;
  const origRendererPick = renderer.pick.bind(renderer);
  renderer.pick = function(_view, _params) {
    gpuPickCalls++;
    return { ok: true, value: null };
  };
  // Stash the original so a debugger session could re-enable GPU pick by
  // calling `renderer.pick = window._origRendererPick` from the console.
  window._origRendererPick = origRendererPick;

  // ---------------------------------------------------------------------
  // City layout (mirrors SceneModel_build_cityscape, scaled up)
  //
  // Object count = 1 (ground slab) + (numBlocks * slotsPerBlock)²
  // ---------------------------------------------------------------------

  const sceneModelResult = scene.createModel({
    id: "cityModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 0, 1, // Up
        0, 1, 0  // Forward
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) {
    throw new Error("Failed to create city SceneModel: " + sceneModelResult.error);
  }
  const sceneModel = sceneModelResult.value;

  // ---- shared geometries ----
  //
  // One unit-box, one straight cylinder (radius 1, height 1, axis along Y),
  // one tapered cylinder (radiusTop ≈ 0.45 of radiusBottom), one unit
  // sphere. Landmarks compose these via per-mesh scale + rotation.
  //
  // Cylinder geometries are built along Y, but our world is Z-up. The
  // landmark builders rotate the cylinder by +π/2 around X so its axis
  // ends up vertical (Y → Z), and scale by [r, h, r] inside the rotation
  // so r/h still mean radius/height after the swap.

  const buildAndRegister = (id, builder) => {
    const result = builder();
    if (!result.ok) throw new Error(`Failed to build ${id}: ${result.error}`);
    const g = result.value;
    sceneModel.createGeometry({
      id,
      primitive: xeokit.base.constants.TrianglesPrimitive,
      positions: g.positions,
      indices: g.indices
    });
  };

  buildAndRegister("box",
    () => xeokit.model.procgen.buildGeometry.buildBox({ xSize: 1, ySize: 1, zSize: 1 }));

  buildAndRegister("cyl", () => xeokit.model.procgen.buildGeometry.buildCylinder({
    radiusTop: 1, radiusBottom: 1, height: 1,
    radialSegments: 28, heightSegments: 1
  }));

  buildAndRegister("tcyl", () => xeokit.model.procgen.buildGeometry.buildCylinder({
    radiusTop: 0.45, radiusBottom: 1, height: 1,
    radialSegments: 28, heightSegments: 1
  }));

  buildAndRegister("sph", () => xeokit.model.procgen.buildGeometry.buildSphere({
    radius: 1, widthSegments: 28, heightSegments: 16
  }));

  // Seeded PRNG — reproducible city every load.
  let seed = 98765;
  const rand = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let nextId = 0;
  const placeBox = (cx, cy, w, d, h, color) => {
    const meshId = `m${nextId}`;
    const objId  = `o${nextId++}`;
    sceneModel.createMesh({
      id: meshId,
      geometryId: "box",
      matrix: xeokit.model.scene.buildMat4({
        position: [cx, cy, h / 2],
        scale:    [w / 2, d / 2, h / 2]
      }),
      color
    });
    sceneModel.createObject({ id: objId, meshIds: [meshId] });
  };

  // Cylinder primitives are built with their axis along local Y. Adding
  // this rotation rotates +Y → +Z so the cylinder stands up in world
  // space.
  //
  // Note: buildMat4's `rotation` parameter is interpreted in DEGREES by
  // the underlying eulerToQuat, not radians — so a 90° rotation around X
  // is `[90, 0, 0]`, not `[Math.PI / 2, 0, 0]` (which would be ~1.57°
  // and leave the cylinder almost flat on its side).
  const ROT_Y_TO_Z = [90, 0, 0];

  // Adds one mesh to the model, returns its id so the caller can collect
  // multiple mesh ids for compound (multi-mesh) landmark objects.
  const addMesh = (geometryId, position, scale, color, rotation) => {
    const id = `m${nextId++}`;
    sceneModel.createMesh({
      id,
      geometryId,
      matrix: xeokit.model.scene.buildMat4({ position, scale, rotation }),
      color
    });
    return id;
  };

  // Iconic-tower landmarks. Each variant is one SceneObject made of
  // 3–7 SceneMeshes mixing boxes, cylinders, tapered cylinders, and
  // spheres — gives the BVH + triangle helper a wide variety of
  // multi-mesh objects with curved and flat surfaces to land hits on.
  //
  // All landmark heights are in metres (the Scene's units = "meters"),
  // chosen to read prominently against the surrounding ~3–22 m boxes.
  const placeLandmark = (cx, cy) => {
    const objId = `o${nextId++}`;
    const meshIds = [];
    const variant = (rand() * 6) | 0;

    if (variant === 0) {
      // === Space Needle ===
      // Tapered trunk (heavy bottom-to-top narrowing), flat flying-saucer
      // disc near the top, thin spire above. The disc edge is a true
      // cylinder side surface, so picking right at the rim is a good
      // edge-of-curve test for the triangle path.
      const trunkH = 18 + rand() * 6;
      const trunkR = 1.0 + rand() * 0.3;
      const saucerR = trunkR * 2.4;
      const saucerH = 0.8;
      const spireH = 5 + rand() * 2;
      meshIds.push(addMesh(
        "tcyl", [cx, cy, trunkH / 2], [trunkR, trunkH, trunkR],
        [0.42, 0.45, 0.50], ROT_Y_TO_Z
      ));
      meshIds.push(addMesh(
        "cyl", [cx, cy, trunkH - 1.0], [saucerR, saucerH, saucerR],
        [0.86, 0.66, 0.22], ROT_Y_TO_Z
      ));
      meshIds.push(addMesh(
        "tcyl", [cx, cy, trunkH + spireH / 2], [0.18, spireH, 0.18],
        [0.86, 0.66, 0.22], ROT_Y_TO_Z
      ));

    } else if (variant === 1) {
      // === CN Tower ===
      // Long tapered concrete column, bulbous viewing-pod sphere about
      // 2/3 up, slender antenna spire on top. The pod is a vertically
      // squished sphere — picking near the equator hits a high-curvature
      // band where AABB-only would land far in front of the surface.
      const colH = 28 + rand() * 14;
      const colR = 0.55 + rand() * 0.15;
      const podR = 1.8;
      const spireH = colH * 0.35;
      meshIds.push(addMesh(
        "tcyl", [cx, cy, colH / 2], [colR * 1.4, colH, colR * 1.4],
        [0.78, 0.80, 0.82], ROT_Y_TO_Z
      ));
      meshIds.push(addMesh(
        "sph", [cx, cy, colH * 0.66], [podR, podR, podR * 0.55],
        [0.50, 0.62, 0.78]
      ));
      meshIds.push(addMesh(
        "tcyl", [cx, cy, colH + spireH / 2], [0.14, spireH, 0.14],
        [0.42, 0.45, 0.50], ROT_Y_TO_Z
      ));

    } else if (variant === 2) {
      // === Sail / Burj-style ===
      // Heavily tapered cylinder reading as a single graceful sweep,
      // capped by a small gold sphere finial — the smallest pickable
      // target on the skyline.
      const h = 22 + rand() * 14;
      const r = 1.7 + rand() * 0.6;
      const finialR = r * 0.18;
      meshIds.push(addMesh(
        "tcyl", [cx, cy, h / 2], [r, h, r],
        [0.93, 0.95, 0.98], ROT_Y_TO_Z
      ));
      meshIds.push(addMesh(
        "sph", [cx, cy, h + finialR * 1.2], [finialR, finialR, finialR],
        [0.95, 0.82, 0.30]
      ));

    } else if (variant === 3) {
      // === Art-deco stepped tower ===
      // 3–5 box tiers, each smaller than the last, terminating in a
      // tapered-cylinder spire. Picking the spire requires bypassing
      // multiple AABB-overlapping tier candidates beneath it, so this is
      // a good multi-mesh ordering test.
      const tiers = 3 + ((rand() * 3) | 0);
      let z = 0;
      let tierW = 1.8 + rand() * 0.8;
      for (let i = 0; i < tiers; i++) {
        const tierH = 4 + rand() * 3;
        meshIds.push(addMesh(
          "box",
          [cx, cy, z + tierH / 2],
          [tierW, tierW, tierH / 2],
          [0.55 + i * 0.04, 0.50 + i * 0.04, 0.42 + i * 0.02]
        ));
        z += tierH;
        tierW *= 0.78;
      }
      const spireH = 4 + rand() * 3;
      meshIds.push(addMesh(
        "tcyl", [cx, cy, z + spireH / 2],
        [tierW * 0.7, spireH, tierW * 0.7],
        [0.82, 0.66, 0.32], ROT_Y_TO_Z
      ));

    } else if (variant === 4) {
      // === Twin towers with sky bridge ===
      // Two cylindrical towers spanned by a box-shaped sky bridge near
      // the top, each crowned with a small sphere lantern. The bridge
      // box and the cylindrical tower bodies share an AABB region, so
      // candidate ordering inside the BVH leaf matters here.
      const towerH = 20 + rand() * 8;
      const towerR = 0.95;
      const spread = 2.4;
      const bridgeZ = towerH * 0.72;
      const bridgeH = 1.2;
      const bridgeColor = [0.55, 0.58, 0.62];
      const towerColor = [0.62, 0.66, 0.72];
      const lanternColor = [0.92, 0.78, 0.30];
      meshIds.push(addMesh(
        "cyl", [cx - spread, cy, towerH / 2], [towerR, towerH, towerR],
        towerColor, ROT_Y_TO_Z
      ));
      meshIds.push(addMesh(
        "cyl", [cx + spread, cy, towerH / 2], [towerR, towerH, towerR],
        towerColor, ROT_Y_TO_Z
      ));
      meshIds.push(addMesh(
        "box", [cx, cy, bridgeZ],
        [spread, towerR * 0.4, bridgeH / 2],
        bridgeColor
      ));
      meshIds.push(addMesh(
        "sph", [cx - spread, cy, towerH + towerR * 0.5],
        [towerR, towerR, towerR], lanternColor
      ));
      meshIds.push(addMesh(
        "sph", [cx + spread, cy, towerH + towerR * 0.5],
        [towerR, towerR, towerR], lanternColor
      ));

    } else {
      // === Drum + dome (Pantheon / mosque) ===
      // Cylindrical drum with a hemispherical dome on top. The dome is
      // a full sphere with its centre at the drum's roof, so only the
      // upper hemisphere is visible — the lower hemisphere lives inside
      // the drum and is harmlessly second in the BVH ordering.
      const r = 1.7 + rand() * 0.9;
      const h = 4 + rand() * 4;
      meshIds.push(addMesh(
        "cyl", [cx, cy, h / 2], [r, h, r],
        [0.93, 0.91, 0.86], ROT_Y_TO_Z
      ));
      meshIds.push(addMesh(
        "sph", [cx, cy, h], [r, r, r],
        [0.86, 0.66, 0.20]
      ));
    }

    sceneModel.createObject({ id: objId, meshIds });
  };

  // Stress-test sizing: 16 super-blocks × 16 slots = 65 536 building slots
  // + 1 ground slab + a downtown sprinkle of multi-mesh iconic landmarks
  // (Space Needle, CN Tower, sail tower, art-deco stepped, twin towers,
  // dome). Total indexed objects are in the 65–70 k range; the BVH grows
  // to several hundred thousand triangles once landmarks are counted.
  const slotSize      = 3;
  const streetWidth   = 5;
  const slotsPerBlock = 16;
  const numBlocks     = 16;

  const blockStride  = slotsPerBlock * slotSize + streetWidth;
  const halfCity     = (numBlocks * blockStride) / 2;
  const cityDiameter = numBlocks * blockStride;

  // Ground slab.
  placeBox(0, 0,
           cityDiameter + streetWidth * 2,
           cityDiameter + streetWidth * 2,
           0.4, [0.18, 0.18, 0.18]);

  for (let bx = 0; bx < numBlocks; bx++) {
    for (let bz = 0; bz < numBlocks; bz++) {
      for (let sx = 0; sx < slotsPerBlock; sx++) {
        for (let sz = 0; sz < slotsPerBlock; sz++) {
          const cx = bx * blockStride + sx * slotSize - halfCity + slotSize / 2;
          const cy = bz * blockStride + sz * slotSize - halfCity + slotSize / 2;

          const nx = (bx + sx / slotsPerBlock) / numBlocks - 0.5;
          const ny = (bz + sz / slotsPerBlock) / numBlocks - 0.5;
          const distNorm = Math.min(1, Math.hypot(nx, ny) / 0.5);

          // Iconic-tower landmarks cluster near downtown — chance scales
          // from ~14% at the centre to 0% at the city edge, so the rim
          // stays a uniform box-grid and the eye is drawn inward toward
          // the variety.
          const landmarkChance = 0.14 * (1 - distNorm);
          if (rand() < landmarkChance) {
            placeLandmark(cx, cy);
            continue;
          }

          const maxH = 28 - distNorm * 22;
          const h    = Math.max(1.5, rand() * maxH);
          const w    = 1.2 + rand() * (slotSize - 1.4);
          const d    = 1.2 + rand() * (slotSize - 1.4);

          const t = h / 28;
          const r = 0.62 - t * 0.22;
          const g = 0.60 - t * 0.12;
          const b = 0.55 + t * 0.20;

          placeBox(cx, cy, w, d, h, [r, g, b]);
        }
      }
    }
  }

  const view = studio.viewManager.createView({
    camera: {
      eye:  [halfCity * 1.4, halfCity * 1.4, halfCity * 1.0],
      look: [0, 0, 8],
      up:   [0, 0, 1]
    }
  });

  // ---------------------------------------------------------------------
  // Pick wiring — uses SceneRaycaster for one-call canvasPos → SDKResult.
  // ---------------------------------------------------------------------

  const picker = new xeokit.spatial.collision.SceneRaycaster(scene);

  // Force the first build off the hover hot path. Times the rebuild cost
  // for the HUD — at this scale (~10k objects) it's the only thing in this
  // pipeline that's not microseconds.
  const buildT0 = performance.now();
  const indexedCount = picker.collisionIndex.size;
  const buildT1 = performance.now();

  const statusObjectId = document.getElementById("hitObjectId");
  const statusPos      = document.getElementById("hitPos");
  const statusT        = document.getElementById("hitT");
  const statusBvhSize  = document.getElementById("hitBvhSize");
  const statusBuildMs  = document.getElementById("hitBuildMs");
  const statusQueryUs  = document.getElementById("hitQueryUs");
  const statusGpuPicks = document.getElementById("hitGpuPicks");
  const pickCursor     = document.getElementById("pickCursor");

  statusBvhSize.textContent = String(indexedCount);
  statusBuildMs.textContent = (buildT1 - buildT0).toFixed(1);

  // Single reusable canvasPos array — SceneRaycaster reads it before
  // returning, so we can rewrite it every event without aliasing risk.
  const canvasPos = [0, 0];
  const canvas = view.htmlElement;

  let cursorVisible = false;
  let cursorIsHit   = false;

  const setCursorState = (visible, hit) => {
    if (visible !== cursorVisible) {
      cursorVisible = visible;
      pickCursor.classList.toggle("parked", !visible);
    }
    if (hit !== cursorIsHit) {
      cursorIsHit = hit;
      pickCursor.classList.toggle("hit", hit);
    }
  };

  // The HTML cursor is positioned in viewport coords via CSS transform.
  // translate3d() lets the browser composite this on the GPU without
  // re-laying-out the page, and it never touches the WebGL canvas.
  const moveCursor = (clientX, clientY) => {
    pickCursor.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
  };

  canvas.addEventListener("mousemove", (e) => {

    moveCursor(e.clientX, e.clientY);

    const rect = canvas.getBoundingClientRect();
    canvasPos[0] = e.clientX - rect.left;
    canvasPos[1] = e.clientY - rect.top;

    const t0 = performance.now();
    const result = picker.pick({ view, canvasPos });
    const t1 = performance.now();
    statusQueryUs.textContent = ((t1 - t0) * 1000).toFixed(1);

    if (!result.ok) {
      // Invalid params — surface to console so the demo doesn't silently
      // mis-pick. Real callers would route this through their own error UI.
      console.error("[SceneRaycaster]", result.error);
      return;
    }

    const r = result.value;
    if (!r.hit) {
      setCursorState(true, false);
      statusObjectId.textContent = "— no hit —";
      statusObjectId.className   = "nohit";
      statusPos.textContent      = "—";
      statusPos.className        = "nohit";
      statusT.textContent        = "—";
      return;
    }

    setCursorState(true, true);

    const wp = r.worldPos;
    statusObjectId.textContent = r.objectId;
    statusObjectId.className   = "value";
    statusPos.textContent      =
      `[${wp[0].toFixed(2)}, ${wp[1].toFixed(2)}, ${wp[2].toFixed(2)}]`;
    statusPos.className        = "value";
    statusT.textContent        = r.tHit.toFixed(3);
  });

  // GPU-pick counter is read on a rAF tick rather than per mousemove so we
  // also catch any picks issued from non-mouse paths (timers, controllers,
  // resize handlers, ...). Stops counting once the page is unloaded.
  let lastReportedGpuPicks = -1;
  const tickGpuPickHud = () => {
    if (gpuPickCalls !== lastReportedGpuPicks) {
      lastReportedGpuPicks = gpuPickCalls;
      statusGpuPicks.textContent = String(gpuPickCalls);
      statusGpuPicks.className = gpuPickCalls === 0 ? "zero" : "nonzero";
    }
    requestAnimationFrame(tickGpuPickHud);
  };
  requestAnimationFrame(tickGpuPickHud);

  // Park the cursor and reset the HUD when the pointer leaves the canvas.
  canvas.addEventListener("mouseleave", () => {
    setCursorState(false, false);
    statusObjectId.textContent = "— move mouse over city —";
    statusObjectId.className   = "nohit";
    statusPos.textContent      = "—";
    statusPos.className        = "nohit";
    statusT.textContent        = "—";
  });

  studio.finished();
});
