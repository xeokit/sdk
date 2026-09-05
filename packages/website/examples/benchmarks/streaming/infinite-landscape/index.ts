import {SDKTask} from "@xeokit/sdk/base/core";
import {LinearEncoding, LinearFilter, sRGBEncoding, TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {buildBox, buildCylinder, buildSphere} from "@xeokit/sdk/model/generation/buildGeometry";
import {paintGranite} from "@xeokit/sdk/model/generation/paintMaterials";
import {Scene, buildMat4} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {finishExample, mustElement, mustOk, toNavigationPick, createExampleRenderer} from "../../../utils/standaloneRuntime.js";
import {createLandscapeSource, GEOM_BOX, GEOM_SLAB, GEOM_CYLINDER, GEOM_DOME} from "./landscape-source.js";

const SLOT_COUNT = 1600;
const WINDOW_W = 320;
const WINDOW_H = 320;
const LANDSCAPE_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => console.error(error));

async function main() {
  // The benchmark explicitly creates SDK components, then drives a dynamic
  // SceneModel with a synthetic streaming instruction source.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      eye: [0, -110, 95],
      look: [0, 5, 6],
      up: [0, 0, 1]
    },
    effects: {
      sky: {enabled: true},
      tonemap: {enabled: true, mode: "aces", sRGBEncode: true},
      sao: {enabled: true, intensity: 0.2, kernelRadius: 50},
      shadows: {
        enabled: true,
        intensity: 0.55,
        cascadeCount: 3,
        pcfKernelSize: 3,
        resolution: 2048,
        direction: [-0.45, -0.35, -0.85]
      },
      edges: {enabled: false}
    }
  }));
  view.lights.ibl.enabled = true;
  view.lights.ibl.intensity = 0.9;
  view.lights.hemispheric.skyColor = [0.78, 0.84, 0.95];
  view.lights.hemispheric.groundColor = [0.5, 0.42, 0.34];
  view.lights.hemispheric.worldUp = [0, 0, 1];
  const renderer = await createExampleRenderer(viewer);
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  const sceneModel = mustOk(scene.createModel({
    id: "infiniteLandscape",
    updateHint: "dynamic",
    coordinateSystem: LANDSCAPE_COORDINATE_SYSTEM
  }));
  registerSharedGeometry(sceneModel);
  registerSharedMaterials(sceneModel);

  const floorMesh = createLandscapeObjects(sceneModel);
  const source = createLandscapeSource({
    slotCount: SLOT_COUNT,
    windowWidth: WINDOW_W,
    windowHeight: WINDOW_H,
    seed: 42
  });
  const controls = createControls();
  let spaceHeld = false;
  const activeGeomBySlot = new Int8Array(SLOT_COUNT);
  activeGeomBySlot.fill(-1);

  window.addEventListener("keydown", (ev) => {
    if (ev.code === "Space" && !spaceHeld) {
      spaceHeld = true;
      ev.preventDefault();
    }
  });
  window.addEventListener("keyup", (ev) => {
    if (ev.code === "Space") {
      spaceHeld = false;
    }
  });

  new SDKTask({
    name: "Infinite landscape - apply instruction stream",
    repeat: true,
    stage: SDKTask.CollectInputStage,
    task: () => {
      if ((controls.flyActive || spaceHeld) && controls.flySpeed > 0) {
        const cam = view.camera;
        const e = cam.eye;
        const l = cam.look;
        let fx = l[0] - e[0];
        let fy = l[1] - e[1];
        const flen = Math.hypot(fx, fy);
        if (flen > 1e-6) {
          fx = fx / flen * controls.flySpeed;
          fy = fy / flen * controls.flySpeed;
          cam.eye = [e[0] + fx, e[1] + fy, e[2]];
          cam.look = [l[0] + fx, l[1] + fy, l[2]];
        }
      }
      const eye = view.camera.eye;
      const cx = eye[0];
      const cy = eye[1];
      floorMesh.matrix = buildMat4({
        position: [cx, cy, -2.5],
        scale: [WINDOW_W * 6, WINDOW_W * 6, 5]
      });
      for (const ins of source.nextFrame(cx, cy)) {
        const previous = activeGeomBySlot[ins.slotId];
        if (ins.hidden) {
          if (previous !== -1) {
            sceneModel.meshes[`s${ins.slotId}_g${previous}`].matrix = PARK_MATRIX;
            activeGeomBySlot[ins.slotId] = -1;
          }
          continue;
        }
        if (previous !== ins.geomType && previous !== -1) {
          sceneModel.meshes[`s${ins.slotId}_g${previous}`].matrix = PARK_MATRIX;
        }
        const mesh = sceneModel.meshes[`s${ins.slotId}_g${ins.geomType}`];
        mesh.matrix = buildMat4({
          position: ins.position,
          scale: ins.scale,
          rotation: ins.rotation
        });
        mesh.color = ins.color;
        if (ins.opacity < 1) {
          const viewObject = view.objects[`slot_${ins.slotId}`];
          if (viewObject) {
            viewObject.opacity = ins.opacity;
          }
        }
        activeGeomBySlot[ins.slotId] = ins.geomType;
      }
    }
  });

  finishExample(renderer, view);
  window.infiniteLandscapeBenchmark = {scene, viewer, view, renderer, picker, inputController, sceneModel, source};
}

const PARK_MATRIX = buildMat4({
  position: [0, 0, -1e4],
  scale: [1e-4, 1e-4, 1e-4]
});

function registerSharedGeometry(sceneModel) {
  const pushGeom = (id, g) => mustOk(sceneModel.createGeometry({
    id,
    primitive: TrianglesPrimitive,
    positions: g.positions,
    normals: g.normals,
    indices: g.indices
  }));
  pushGeom("box", mustOk(buildBox({xSize: 1, ySize: 1, zSize: 1})));
  const cylRaw = mustOk(buildCylinder({radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 24}));
  const cylPositions = new Float32Array(cylRaw.positions);
  const cylNormals = new Float32Array(cylRaw.normals);
  rotateXBy90(cylPositions);
  rotateXBy90(cylNormals);
  mustOk(sceneModel.createGeometry({
    id: "cyl",
    primitive: TrianglesPrimitive,
    positions: cylPositions,
    normals: cylNormals,
    indices: cylRaw.indices
  }));
  pushGeom("dome", mustOk(buildSphere({radius: 0.5, widthSegments: 24, heightSegments: 16})));
}

function registerSharedMaterials(sceneModel) {
  mustOk(sceneModel.createMaterial({id: "FLOOR", color: [0.2, 0.22, 0.22], roughness: 1, metallic: 0}));
  const stoneMaps = paintGranite(512);
  mustOk(sceneModel.createTexture({
    id: "tex_stone_color",
    imageData: stoneMaps.color,
    encoding: sRGBEncoding,
    minFilter: LinearFilter,
    mipmap: true,
    flipY: false
  }));
  mustOk(sceneModel.createTexture({
    id: "tex_stone_normal",
    imageData: stoneMaps.normal,
    encoding: LinearEncoding,
    minFilter: LinearFilter,
    mipmap: true,
    flipY: false
  }));
  mustOk(sceneModel.createTexture({
    id: "tex_stone_mr",
    imageData: stoneMaps.mr,
    encoding: LinearEncoding,
    minFilter: LinearFilter,
    mipmap: true,
    flipY: false
  }));
  mustOk(sceneModel.createMaterial({
    id: "STONE",
    color: [1, 1, 1],
    roughness: 1,
    metallic: 0,
    colorTextureId: "tex_stone_color",
    normalsTextureId: "tex_stone_normal",
    metallicRoughnessTextureId: "tex_stone_mr"
  }));
}

function createLandscapeObjects(sceneModel) {
  const geomToGeometryId = {
    [GEOM_BOX]: "box",
    [GEOM_SLAB]: "box",
    [GEOM_CYLINDER]: "cyl",
    [GEOM_DOME]: "dome"
  };
  mustOk(sceneModel.createMesh({
    id: "floorMesh",
    geometryId: "box",
    materialId: "FLOOR",
    matrix: buildMat4({
      position: [0, 0, -2.5],
      scale: [WINDOW_W * 6, WINDOW_W * 6, 5]
    })
  }));
  mustOk(sceneModel.createObject({id: "floor", meshIds: ["floorMesh"]}));
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const meshIds = [];
    for (const geomType of [GEOM_BOX, GEOM_SLAB, GEOM_CYLINDER, GEOM_DOME]) {
      const meshId = `s${slot}_g${geomType}`;
      mustOk(sceneModel.createMesh({
        id: meshId,
        geometryId: geomToGeometryId[geomType],
        matrix: PARK_MATRIX,
        color: initialSlotColor(slot, geomType),
        ...(geomType === GEOM_BOX || geomType === GEOM_SLAB ? {materialId: "STONE"} : {})
      }));
      meshIds.push(meshId);
    }
    mustOk(sceneModel.createObject({id: `slot_${slot}`, meshIds}));
  }
  return sceneModel.meshes.floorMesh;
}

function createControls() {
  const panel = document.createElement("div");
  panel.style.cssText = "position:fixed;right:12px;top:52px;z-index:10;background:rgba(255,255,255,.92);border:1px solid rgba(0,0,0,.15);padding:10px 12px;font:12px system-ui,sans-serif;color:#20242a";
  const toggle = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  toggle.append(checkbox, document.createTextNode(" Fly forward"));
  const speed = document.createElement("input");
  speed.type = "range";
  speed.min = "0";
  speed.max = "10";
  speed.step = "0.1";
  speed.value = "3";
  panel.append(toggle, document.createElement("br"), speed);
  document.body.appendChild(panel);
  return {
    get flyActive() {
      return checkbox.checked;
    },
    get flySpeed() {
      return Number(speed.value);
    }
  };
}

function rotateXBy90(arr) {
  for (let i = 0; i < arr.length; i += 3) {
    const y = arr[i + 1];
    const z = arr[i + 2];
    arr[i + 1] = -z;
    arr[i + 2] = y;
  }
}

function initialSlotColor(slot, geomType) {
  const tag = slot * 73856093 ^ geomType * 19349663 ^ 12648430;
  const h = (Math.sin(tag * 91.117) * 47453.5453 % 1 + 1) % 1;
  const s = 0.7;
  const l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h * 6;
  const x = c * (1 - Math.abs(hp % 2 - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}
