// Inverse-gravity physics on the Duplex building.
//
// This example keeps the SDK integration visible: it builds a Scene, Viewer,
// View, renderer, navigation controller, XGF-loaded building model, separate
// scene-authored ground slab, and a Rapier-backed ScenePhysics instance in one
// entrypoint.

import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {buildBox} from "@xeokit/sdk/model/generation/buildGeometry";
import {buildMat4, Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {getScenePhysics} from "../../../../libs/examples/dist/physics/index.js";
import {failExample, fetchArrayBuffer, finishExample, mustElement, mustOk, setStatus, toNavigationPick} from "../../../utils/standaloneRuntime.js";

const XGF_URL = "../../../../models/Duplex/xgf/model.xgf";
const RAPIER_MODULE_URL = "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/+esm";

// This is the content of packages/website/models/Duplex/coordSys.json, inlined
// so the example shows exactly what coordinate metadata the loader needs.
const DUPLEX_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

// The slab is authored directly in scene coordinates. Keep it in a separate
// model so its Z-up physics frame is not coupled to the imported model basis.
const SCENE_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 0, 1,
    0, 1, 0
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const GRAVITY_UP = [0, 0, 2.0];
const GRAVITY_DOWN = [0, 0, -9.81];

main().catch((error) => failExample("simulation/physics/duplex", error));

async function main() {
  // Create the SDK runtime directly. WebGL keeps this example focused on the
  // physics behaviour and gives stable shadow/grid support for the moving parts.
  const scene = new Scene();
  const viewer = new Viewer({scene});
  const view = mustOk(viewer.createView({
    id: "duplexPhysicsView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.96, 0.97, 0.98],
    adaptiveQuality: false,
    camera: {
      eye: [17.72161957650151, 44.49799256639463, 7.60023940967586],
      look: [6.3461603399405675, 12.647537368689676, -0.9398725713611356],
      up: [-0.0823455994081705, -0.2305616453606706, 0.9695671869172808]
    },
    effects: {
      sky: {enabled: true},
      edges: {enabled: false},
      sao: {enabled: true, intensity: 0.08, scale: 0.8},
      tonemap: {enabled: true, mode: "aces", exposure: 0.65, sRGBEncode: true},
      shadows: {
        enabled: true,
        autoFit: true,
        intensity: 0.6,
        cascadeCount: 3,
        cascadeSplitLambda: 0.5,
        pcfKernelSize: 3,
        resolution: 2048,
        bias: 0.001,
        normalOffsetBias: 0.04,
        slopeBias: 0.004,
        maxDistance: 60,
        padding: 1.1,
        direction: [-0.45, -0.35, -0.80]
      }
    }
  }));
  const renderer = new WebGLRenderer({viewer});
  mustOk(renderer.setInfiniteGridEnabled(true));

  // Navigation uses the same renderer-backed picking path that production
  // viewers normally use for orbit pivots and double-click fly-to targets.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false
  });

  const status = mustElement("status");
  const hudBodies = mustElement("hudBodies");
  const hudDynamic = mustElement("hudDynamic");
  const hudStepMs = mustElement("hudStepMs");
  const hudFps = mustElement("hudFps");
  const hudGravity = mustElement("hudGravity");
  const collapseBtn = mustElement("initiateCollapse") as HTMLButtonElement;
  const toggleBtn = mustElement("toggleGravity") as HTMLButtonElement;

  // SceneModel receives the imported renderable geometry. The coordinate system
  // is supplied before loading so XGF positions are transformed into the scene.
  const duplexModel = mustOk(scene.createModel({
    id: "duplexModel",
    coordinateSystem: DUPLEX_COORDINATE_SYSTEM,
    updateHint: "dynamic"
  }));

  setStatus("status", "Loading Duplex XGF...");
  const rapierReady = loadRapier();
  const fileData = await fetchArrayBuffer(XGF_URL);
  const loadResult = await new XGFLoader().load({fileData, sceneModel: duplexModel});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  setStatus("status", "Initialising physics...");
  const RAPIER = await rapierReady;

  // Size the fixed slab from the building's world bounds. The collision index
  // provides a scene AABB without requiring a camera fit or hard-coded extents.
  const collisionIndex = getSceneCollisionIndex(scene);
  const buildingAABB = collisionIndex.getSceneAABB();
  const slabModel = createGroundSlab(scene, buildingAABB);

  // ScenePhysics is one engine per Scene. Disable auto bodies so the example
  // can make the slab fixed and defer making building parts dynamic until the
  // user presses the collapse button.
  const physics = getScenePhysics(scene, {
    rapier: RAPIER,
    gravity: GRAVITY_DOWN,
    autoCreateBodies: false
  });

  const slabObjectId = "slab";
  physics.setBody(slabObjectId, {type: "fixed", shape: "cuboid"});

  const buildingObjects = duplexModel.objects;
  for (const objectId in buildingObjects) {
    physics.setBody(objectId, {type: "fixed", shape: "cuboid"});
  }

  let dynamicCount = 0;
  let collapsed = false;
  let gravityIsUp = false;

  collapseBtn.addEventListener("click", () => {
    if (collapsed) {
      return;
    }
    collapsed = true;
    dynamicCount = makeBuildingDynamic(physics, buildingObjects);
    collapseBtn.disabled = true;
    collapseBtn.textContent = "Collapsed";
    status.textContent = "Collapse in progress - toggle gravity to reverse.";
  });

  toggleBtn.addEventListener("click", () => {
    gravityIsUp = !gravityIsUp;
    physics.setGravity(gravityIsUp ? GRAVITY_UP : GRAVITY_DOWN);
    for (const objectId in buildingObjects) {
      const body = physics.getBody(objectId);
      if (body) {
        body.wakeUp();
      }
    }
    hudGravity.textContent = gravityIsUp ? "up (drifting)" : "down (falling)";
  });

  // Step Rapier once per animation frame and let ScenePhysics write the updated
  // body transforms back onto the corresponding SceneObjects.
  let lastFrameMs = performance.now();
  let fpsAvg = 0;
  let nextHudUpdate = lastFrameMs + 250;

  const tick = (now) => {
    const dt = (now - lastFrameMs) / 1000;
    lastFrameMs = now;
    const fps = dt > 0 ? 1 / dt : 0;
    fpsAvg = fpsAvg === 0 ? fps : fpsAvg * 0.9 + fps * 0.1;

    const t0 = performance.now();
    physics.step();
    const stepMs = performance.now() - t0;

    if (now > nextHudUpdate) {
      nextHudUpdate = now + 250;
      hudBodies.textContent = String(physics.size);
      hudDynamic.textContent = String(dynamicCount);
      hudStepMs.textContent = stepMs.toFixed(2);
      hudFps.textContent = fpsAvg.toFixed(0);
    }

    requestAnimationFrame(tick);
  };

  hudGravity.textContent = "down (falling)";
  status.textContent = "Click \"Initiate collapse\" to drop the building under gravity.";
  requestAnimationFrame(tick);

  finishExample(renderer, view);
  window.duplexPhysicsExample = {scene, viewer, view, renderer, picker, inputController, duplexModel, slabModel, physics};
}

async function loadRapier() {
  // Rapier owns WASM initialisation. Keep it outside the SDK bundle and pass the
  // initialised namespace into getScenePhysics.
  const module = await import(RAPIER_MODULE_URL);
  const RAPIER = module.default;
  await RAPIER.init();
  return RAPIER;
}

function createGroundSlab(scene, buildingAABB) {
  const slabModel = mustOk(scene.createModel({
    id: "slabModel",
    coordinateSystem: SCENE_COORDINATE_SYSTEM,
    updateHint: "dynamic"
  }));

  const slabBoxGeom = mustOk(buildBox({xSize: 1, ySize: 1, zSize: 1}));
  mustOk(slabModel.createGeometry({
    id: "slabBox",
    primitive: TrianglesPrimitive,
    positions: slabBoxGeom.positions,
    indices: slabBoxGeom.indices
  }));

  const slabSizeXY = Math.max(
    buildingAABB[3] - buildingAABB[0],
    buildingAABB[4] - buildingAABB[1]
  ) * 1.6;
  const slabThickness = 0.4;
  const slabCx = (buildingAABB[0] + buildingAABB[3]) * 0.5;
  const slabCy = (buildingAABB[1] + buildingAABB[4]) * 0.5;
  const slabCz = buildingAABB[2] - slabThickness * 0.5;

  mustOk(slabModel.createMesh({
    id: "slabMesh",
    geometryId: "slabBox",
    matrix: buildMat4({
      position: [slabCx, slabCy, slabCz],
      scale: [slabSizeXY * 0.5, slabSizeXY * 0.5, slabThickness * 0.5]
    }),
    color: [0.55, 0.55, 0.55]
  }));
  mustOk(slabModel.createObject({id: "slab", meshIds: ["slabMesh"]}));
  return slabModel;
}

function makeBuildingDynamic(physics, buildingObjects) {
  let dynamicCount = 0;
  for (const objectId in buildingObjects) {
    physics.setBody(objectId, {
      type: "dynamic",
      shape: "cuboid",
      density: 1.0,
      friction: 0.5,
      restitution: 0.05
    });
    const body = physics.getBody(objectId);
    if (body) {
      body.setAngvel({
        x: (Math.random() - 0.5) * 0.5,
        y: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.5
      }, true);
      body.setLinvel({
        x: (Math.random() - 0.5) * 0.3,
        y: (Math.random() - 0.5) * 0.3,
        z: 0
      }, true);
    }
    dynamicCount++;
  }
  return dynamicCount;
}
