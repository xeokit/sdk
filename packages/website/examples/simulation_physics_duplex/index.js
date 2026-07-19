// Physics on a small block-only cityscape, driven by Rapier through
// ScenePhysics.
//
// The city is generated procedurally as ~325 boxes on a slab — small
// (~57 m across, roughly a third of the linear scale of the SAO/shadows
// cityscape) and uniform so the auto-created cuboid colliders match the
// visible meshes exactly with no fudging.
//
// Rapier is loaded from a CDN and injected into ScenePhysics — the xeokit
// SDK never bundles Rapier itself, so we pull the WASM-bundled compat
// build (`@dimforge/rapier3d-compat`) at runtime and pass the namespace
// straight in.
//
// Inverse-gravity demo on the Duplex IFC building (loaded as XGF).
//
// Every SceneObject from the Duplex XGF (walls, slabs, doors, windows,
// fixtures, ...) becomes a dynamic Rapier body. The world's gravity
// vector points UP (positive Z), so the building slowly lifts off the
// ground slab and disassembles itself in mid-air as collisions push
// the parts apart.
//
// The ground slab is a separate SceneModel positioned beneath the
// building's AABB, kept fixed so there's a stable visual reference for
// "where the building used to be" as the parts drift away.
//
// "Toggle gravity" flips the gravity vector between up and down — flip
// it the other way and the building parts fall back to the ground in a
// heap that will look nothing like the original house.
//
// Animation loop: physics.step() once per frame, which advances Rapier
// and writes new world matrices back to every dynamic mesh.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene } = studio;

  // -----------------------------------------------------------------
  // Two SceneModels:
  //   - duplexModel  → loaded from the Duplex XGF.
  //   - slabModel    → a single fixed slab beneath the building.
  //
  // Duplex is authored Y-up, while the scene and slab are Z-up. The
  // SceneModel basis on the Duplex model remaps it into the scene so
  // gravity = [0, 0, ±n] points the way you'd expect.
  // -----------------------------------------------------------------

  const DUPLEX_Y_UP_BASIS = {
    basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    origin: [0, 0, 0],
    units: "meters",
    scaleToMeters: 1
  };

  const SCENE_Z_UP_BASIS = {
    basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
    origin: [0, 0, 0],
    units: "meters",
    scaleToMeters: 1
  };

  const duplexModel = mustOK(scene.createModel({
    id: "duplexModel",
    coordinateSystem: DUPLEX_Y_UP_BASIS
  }));

  const view = studio.viewManager.createView({
    camera: {
      // 30% closer along the original eye→look line, same direction.
      eye:  [17.72161957650151, 44.49799256639463, 7.60023940967586],
      look: [6.3461603399405675, 12.647537368689676, -0.9398725713611356],
      up:   [-0.0823455994081705, -0.2305616453606706, 0.9695671869172808]
    }
  });
  const adaptiveQuality = xeokit.viewing.adaptiveQuality.AdaptiveQuality.getFor(view);
  if (adaptiveQuality) {
    adaptiveQuality.enabled = false;
  }
  view.renderMode = xeokit.base.constants.RealisticRender;

  const status      = document.getElementById("status");
  const hudBodies   = document.getElementById("hudBodies");
  const hudDynamic  = document.getElementById("hudDynamic");
  const hudStepMs   = document.getElementById("hudStepMs");
  const hudFps      = document.getElementById("hudFps");
  const hudGravity  = document.getElementById("hudGravity");
  const collapseBtn = document.getElementById("initiateCollapse");
  const toggleBtn   = document.getElementById("toggleGravity");

  // ID of the slab SceneObject we'll create inside slabModel after the
  // building loads. Filled in once we know the building's footprint.
  let slabObjectId  = "slab";

  const xgfLoader  = new xeokit.formats.xgf.XGFLoader();

  const xgfLoaded  = fetch("../../models/Duplex/xgf/model.xgf")
    .then(response => response.arrayBuffer())
    .then(fileData => xgfLoader.load({ fileData, sceneModel: duplexModel }));

  const rapierReady = import("https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/+esm")
    .then(module => {
      const RAPIER = module.default;
      return RAPIER.init().then(() => RAPIER);
    });

  Promise.all([xgfLoaded, rapierReady]).then(([, RAPIER]) => {

    status.textContent = "Initialising physics…";

    // -----------------------------------------------------------------
    // Build a ground slab below the loaded building. We size it from
    // the loaded model's world AABB so it covers the footprint with a
    // little margin, regardless of where the building lands in space.
    // -----------------------------------------------------------------

    const buildingAABB = studio.picking.collisionIndex.getSceneAABB();
    const slabModel = mustOK(scene.createModel({
      id: "slabModel",
      coordinateSystem: SCENE_Z_UP_BASIS
    }));

    const slabBoxGeom = mustOK(xeokit.model.procgen.buildGeometry.buildBox({
      xSize: 1, ySize: 1, zSize: 1
    }));
    slabModel.createGeometry({
      id: "slabBox",
      primitive: xeokit.base.constants.TrianglesPrimitive,
      positions: slabBoxGeom.positions,
      indices: slabBoxGeom.indices
    });

    const slabSizeXY = Math.max(
      buildingAABB[3] - buildingAABB[0],
      buildingAABB[4] - buildingAABB[1]
    ) * 1.6;
    const slabThickness = 0.4;
    const slabCx = (buildingAABB[0] + buildingAABB[3]) * 0.5;
    const slabCy = (buildingAABB[1] + buildingAABB[4]) * 0.5;
    const slabCz = buildingAABB[2] - slabThickness * 0.5;  // top of slab kisses model floor

    slabModel.createMesh({
      id: "slabMesh",
      geometryId: "slabBox",
      matrix: xeokit.model.scene.buildMat4({
        position: [slabCx, slabCy, slabCz],
        scale:    [slabSizeXY * 0.5, slabSizeXY * 0.5, slabThickness * 0.5]
      }),
      color: [0.55, 0.55, 0.55]
    });
    slabModel.createObject({ id: slabObjectId, meshIds: ["slabMesh"] });

    // (Camera is already set to the exact eye/look/up the example
    // wants; we deliberately don't call studio.viewFit here so the
    // intended composition is preserved.)

    // -----------------------------------------------------------------
    // Shadows — directional light shadow mapping with a 3-cascade CSM.
    // autoFit lets the frustum follow the building+slab AABB so we
    // don't have to retune projectionSize / lightDistance as the parts
    // drift through space.
    // -----------------------------------------------------------------
    const sh = view.effects.shadows;
    sh.renderModes        = [xeokit.base.constants.RealisticRender];
    sh.autoFit            = true;
    sh.intensity          = 0.6;
    sh.cascadeCount       = 3;
    sh.cascadeSplitLambda = 0.5;
    sh.pcfKernelSize      = 3;
    sh.resolution         = 2048;
    sh.bias               = 0.001;
    sh.normalOffsetBias   = 0.04;
    sh.slopeBias          = 0.004;
    sh.maxDistance        = 60;
    sh.padding            = 1.1;
    sh.direction          = [-0.45, -0.35, -0.80];

    // -----------------------------------------------------------------
    // Physics: positive-Z gravity (this is a Z-up scene), so it points
    // UP and the building drifts off the slab.
    // -----------------------------------------------------------------

    const GRAVITY_UP   = [0, 0,  2.0];
    const GRAVITY_DOWN = [0, 0, -9.81];
    let gravityIsUp = false;

    // Auto-creation off — we decide per-object what kind of body each
    // gets (slab fixed, every loaded SceneObject dynamic).
    const physics = xeokit.simulation.physics.getScenePhysics(scene, {
      rapier: RAPIER,
      gravity: GRAVITY_DOWN,
      autoCreateBodies: false
    });

    physics.setBody(slabObjectId, { type: "fixed", shape: "cuboid" });

    // Building parts start as FIXED bodies — the house stands intact
    // until "Initiate collapse" is pressed. physics.step() runs every
    // frame regardless; fixed bodies just don't move.
    const buildingObjects = duplexModel.objects;
    for (const objectId in buildingObjects) {
      physics.setBody(objectId, { type: "fixed", shape: "cuboid" });
    }
    let dynamicCount = 0;
    let collapsed = false;

    /**
     * Convert every building part from fixed to dynamic and apply a
     * tiny random tumble + lateral nudge so the disassembly looks
     * chaotic instead of monolithic.
     */
    const initiateCollapse = () => {
      if (collapsed) return;
      collapsed = true;
      for (const objectId in buildingObjects) {
        physics.setBody(objectId, {
          type:        "dynamic",
          shape:       "cuboid",
          density:     1.0,
          friction:    0.5,
          restitution: 0.05
        });
        const body = physics.getBody(objectId);
        if (body) {
          body.setAngvel(
            {
              x: (Math.random() - 0.5) * 0.5,
              y: (Math.random() - 0.5) * 0.5,
              z: (Math.random() - 0.5) * 0.5
            },
            true
          );
          body.setLinvel(
            {
              x: (Math.random() - 0.5) * 0.3,
              y: (Math.random() - 0.5) * 0.3,
              z: 0
            },
            true
          );
        }
        dynamicCount++;
      }
      collapseBtn.disabled = true;
      collapseBtn.textContent = "Collapsed";
      status.textContent = "Collapse in progress — toggle gravity to reverse.";
    };

    collapseBtn.addEventListener("click", initiateCollapse);

    toggleBtn.addEventListener("click", () => {
      gravityIsUp = !gravityIsUp;
      physics.setGravity(gravityIsUp ? GRAVITY_UP : GRAVITY_DOWN);
      // Wake every dynamic body so the new gravity takes effect even
      // for any that may have already drifted to sleep.
      for (const objectId in buildingObjects) {
        const body = physics.getBody(objectId);
        if (body) body.wakeUp();
      }
      hudGravity.textContent = gravityIsUp ? "↑ up (drifting)" : "↓ down (falling)";
    });

    // -----------------------------------------------------------------
    // Animation loop — fixed timestep at 60 Hz. FPS / step-time HUD.
    // -----------------------------------------------------------------

    let lastFrameMs   = performance.now();
    let fpsAvg        = 0;
    let frameCounter  = 0;
    let nextHudUpdate = lastFrameMs + 250;

    const tick = (now) => {
      const dt = (now - lastFrameMs) / 1000;
      lastFrameMs = now;
      // Cheap exponential moving average so the FPS readout stops
      // jittering frame to frame.
      const inst = dt > 0 ? 1 / dt : 0;
      fpsAvg = fpsAvg === 0 ? inst : fpsAvg * 0.9 + inst * 0.1;

      const t0 = performance.now();
      physics.step();
      const stepMs = performance.now() - t0;

      frameCounter++;
      if (now > nextHudUpdate) {
        nextHudUpdate = now + 250;
        hudBodies.textContent  = String(physics.size);
        hudDynamic.textContent = String(dynamicCount);
        hudStepMs.textContent  = stepMs.toFixed(2);
        hudFps.textContent     = fpsAvg.toFixed(0);
      }

      requestAnimationFrame(tick);
    };

    hudGravity.textContent = "↓ down (falling)";
    status.textContent = "Click \"Initiate collapse\" to drop the building under gravity.";
    requestAnimationFrame(tick);

    studio.finished();

  }).catch(err => {
    status.textContent = `Failed to start: ${err}`;
    console.error("simulation_physics_duplex:", err);
  });
});

function mustOK(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
