// Infinite-landscape demo.
//
// A pool of N "slots" — each slot is one SceneObject holding four
// SceneMeshes (one per shared geometry: box, slab, cylinder, dome).
// At any moment, only one mesh per slot is "active" (placed at the
// slot's transform); the other three are parked at scale ≈ 0 far below
// the floor where they cost nothing.
//
// Each frame the demo asks an EXTERNAL source module
// (`landscape-source.js`) for one frame of instructions — a flat array
// of `{slotId, geomType, position, rotation, scale, color, opacity}`
// tuples — then walks the array writing each tuple onto the matching
// slot's active mesh. When `geomType` flips (i.e. the slot wrapped an
// edge and re-rolled), the previously-active mesh is parked and the
// new one takes over.
//
// The source treats the world as a fixed-size window in the X-Y plane;
// dragging on the canvas accumulates a pan offset, slots that cross
// the window edge wrap to the opposite side, and a hash of
// `(slotId, wrapCountX, wrapCountY)` re-picks geometry/scale/colour so
// the recycled slot looks like a brand-new building.
//
// In a real system the source could be a recorded clip, a server-
// streamed feed, or anything else producing per-frame state — index.js
// only knows the instruction shape.
import * as xeokit from "../../js/xeokit-studio-bundle.js";
import {
  createLandscapeSource,
  GEOM_BOX, GEOM_SLAB, GEOM_CYLINDER, GEOM_DOME
} from "./landscape-source.js";
// Building texture lives in the SDK's procgen painter library —
// no example-local painter needed. Swap `paintGranite` for any
// other entry in `xeokit.model.procgen.paintMaterials` (brick,
// limestone, marble, etc.) to retint the city.
const {paintGranite} = xeokit.model.procgen.paintMaterials;

const SLOT_COUNT  = 1600;       // 100 groups × GROUP_SIZE(=16) members
const WINDOW_W    = 320;        // ~32 m per group cell
const WINDOW_H    = 320;

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {
  const { scene } = studio;

  // ── Scene model ─────────────────────────────────────────────────
  // Z-up basis (matches the other recent demos). Geometry is built in
  // its native xeokit Y-up orientation, then the basis re-maps local Y
  // → world Z so cylinders stand and box buildings sit naturally on
  // the ground.
  const sceneModel = mustCreate(scene.createModel({
    id: "infiniteLandscape",
    coordinateSystem: {
      basis: [1, 0, 0,  0, 0, 1,  0, 1, 0],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));

  // ── Shared geometries ───────────────────────────────────────────
  // Four primitives, each unit-sized and centred at the origin. Per-
  // slot scale + rotation + position is applied via the mesh matrix.
  //
  // Note: UVs are intentionally omitted. The renderer keys on
  // `hasUVs` per batch — when a batch has no UVs, the triplanar
  // shader path takes over and samples the material's color /
  // normal / MR textures by projecting from the three world axes
  // weighted by the surface normal. That avoids the unit-cube's
  // [0..1]² per-face UV stretching the stone texture differently
  // on a 10 m × 2 m wall than on a 4 m × 4 m one — every face
  // samples in the same world-space frequency regardless of
  // per-mesh scale.
  const pushGeom = (id, g) => sceneModel.createGeometry({
    id,
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: g.positions,
    normals:   g.normals,
    indices:   g.indices
  });
  pushGeom("box",
    mustBuild(xeokit.model.procgen.buildGeometry.buildBox({ xSize: 1, ySize: 1, zSize: 1 })));
  // Rotate the cylinder geometry so its native axis points along
  // world +Z (vertical) instead of the builder's default world +Y.
  // Without this, a "default" cylinder lies horizontally in our Z-up
  // world; scaling its X/Y/Z components turns it into an oval rather
  // than a tall vertical post. We use a proper R_x(+π/2) rotation
  // (`(x, y, z) → (x, -z, y)`) — not a Y/Z swap — so triangle winding
  // stays right-handed and back-face culling still works.
  const cylRaw = mustBuild(xeokit.model.procgen.buildGeometry.buildCylinder({
    radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 24
  }));
  const cylPositions = new Float32Array(cylRaw.positions);
  const cylNormals   = new Float32Array(cylRaw.normals);
  rotateXBy90(cylPositions);
  rotateXBy90(cylNormals);
  sceneModel.createGeometry({
    id: "cyl",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: cylPositions,
    normals:   cylNormals,
    indices:   cylRaw.indices
  });
  pushGeom("dome",
    mustBuild(xeokit.model.procgen.buildGeometry.buildSphere({
      radius: 0.5, widthSegments: 24, heightSegments: 16
    })));

  // Slab uses the box geometry too — it's just a box scaled flat.
  const GEOM_TO_GEOMETRY_ID = {
    [GEOM_BOX]:      "box",
    [GEOM_SLAB]:     "box",
    [GEOM_CYLINDER]: "cyl",
    [GEOM_DOME]:     "dome"
  };
  const ALL_GEOM_TYPES = [GEOM_BOX, GEOM_SLAB, GEOM_CYLINDER, GEOM_DOME];

  // ── Floor — one massive slab the camera flies over ──────────────
  // Sized to comfortably exceed any sensible camera roam range; we
  // also re-centre it on the camera each frame so the user never
  // sees its edge regardless of how far they fly.
  mustCreate(sceneModel.createMaterial({
    id: "FLOOR", color: [0.20, 0.22, 0.22], roughness: 1.0, metallic: 0
  }));

  // ── Stone-block PBR material for the building bodies ───────────
  // Three textures painted by `paintStoneBlock` (a custom procgen
  // painter shaped like the SDK ones in `model/procgen/paintMaterials/`).
  // 512×512 is the sweet spot between bump detail and GPU memory at
  // this slot count. sRGB encoding for albedo only — normal + MR are
  // linear-data textures. Mipmapped + LinearFilter to keep the stone
  // grain stable when buildings recede into the distance during a
  // flight.
  const STONE_TEX_SIZE = 512;
  const stoneMaps = paintGranite(STONE_TEX_SIZE);
  mustCreate(sceneModel.createTexture({
    id: "tex_stone_color",
    imageData: stoneMaps.color,
    encoding: xeokit.base.constants.sRGBEncoding,
    minFilter: xeokit.base.constants.LinearFilter,
    mipmap: true, flipY: false,
  }));
  mustCreate(sceneModel.createTexture({
    id: "tex_stone_normal",
    imageData: stoneMaps.normal,
    encoding: xeokit.base.constants.LinearEncoding,
    minFilter: xeokit.base.constants.LinearFilter,
    mipmap: true, flipY: false,
  }));
  mustCreate(sceneModel.createTexture({
    id: "tex_stone_mr",
    imageData: stoneMaps.mr,
    encoding: xeokit.base.constants.LinearEncoding,
    minFilter: xeokit.base.constants.LinearFilter,
    mipmap: true, flipY: false,
  }));
  // The material's own `color` is the texture-multiplier slot —
  // pinned to white so the per-mesh `mesh.color` writes (one per
  // slot per recycle frame) act as a tint over the stone albedo
  // rather than crushing it to grey.
  mustCreate(sceneModel.createMaterial({
    id: "STONE",
    color: [1.0, 1.0, 1.0],
    roughness: 1.0,
    metallic: 0,
    colorTextureId:             "tex_stone_color",
    normalsTextureId:           "tex_stone_normal",
    metallicRoughnessTextureId: "tex_stone_mr",
  }));
  const FLOOR_SIZE = WINDOW_W * 6;
  sceneModel.createMesh({
    id: "floorMesh",
    geometryId: "box",
    materialId: "FLOOR",
    matrix: xeokit.model.scene.buildMat4({
      position: [0, 0, -2.5],
      scale:    [FLOOR_SIZE, FLOOR_SIZE, 5]
    })
  });
  sceneModel.createObject({ id: "floor", meshIds: ["floorMesh"] });
  const floorMesh = sceneModel.meshes["floorMesh"];

  // ── Slot pool ────────────────────────────────────────────────────
  // One SceneObject per slot, with one SceneMesh per geom type in it.
  // Per-frame the active mesh holds the slot's real transform; the
  // others are parked via PARK_MATRIX (scale ~ 0, far below the floor).
  // PARK_MATRIX is built once and reused — the matrix setter copies it.
  const PARK_MATRIX = xeokit.model.scene.buildMat4({
    position: [0, 0, -10000],
    scale:    [0.0001, 0.0001, 0.0001]
  });

  // Tracks which geom-type's mesh is currently active per slot, so the
  // first frame of a wrap can park the previously-active one.
  const activeGeomBySlot = new Int8Array(SLOT_COUNT);
  for (let i = 0; i < SLOT_COUNT; i++) activeGeomBySlot[i] = -1;

  // Bake an initial varied colour per (slot, geomType) so the first
  // frame already renders coloured (rather than pure white) — also
  // gives the demo a sane fallback if a recycle frame's dynamic
  // mesh.color update doesn't immediately round-trip on the very first
  // tick. The runtime `mesh.color = ins.color` writes overwrite this
  // as soon as instructions start streaming.
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const meshIds = [];
    for (const gt of ALL_GEOM_TYPES) {
      const meshId = `s${slot}_g${gt}`;
      // Stone-block PBR for the prismatic geom types (box, slab);
      // the rounded geoms (cylinder, dome) stay colour-only so the
      // UV wrap doesn't smear the stone-block pattern across their
      // continuous surface. Either branch still respects the
      // per-mesh `mesh.color` tint written each recycle frame.
      const useStone = gt === GEOM_BOX || gt === GEOM_SLAB;
      sceneModel.createMesh({
        id: meshId,
        geometryId: GEOM_TO_GEOMETRY_ID[gt],
        matrix: PARK_MATRIX,
        color:  initialSlotColor(slot, gt),
        ...(useStone ? {materialId: "STONE"} : {}),
      });
      meshIds.push(meshId);
    }
    sceneModel.createObject({ id: `slot_${slot}`, meshIds });
  }

  // ── View, lighting, effects ─────────────────────────────────────
  const view = studio.viewManager.createView({
    camera: {
      // High oblique vantage looking at the centre of the window. The
      // window is panned by accumulating an offset in the source, not
      // by moving the camera.
      eye:  [0, -110, 95],
      look: [0, 5, 6],
      up:   [0, 0, 1]
    },
    renderMode: xeokit.base.constants.DetailedRender,
    effects: {
      tonemap: { sRGBEncode: true }
    }
  });

  view.effects.sao.renderModes = [xeokit.base.constants.DetailedRender, xeokit.base.constants.RealisticRender];
  view.effects.sao.intensity = 0.20;
  view.effects.sao.kernelRadius = 50;

  view.effects.shadows.renderModes = [xeokit.base.constants.DetailedRender, xeokit.base.constants.RealisticRender];
  view.effects.shadows.intensity = 0.55;
  view.effects.shadows.cascadeCount = 3;
  view.effects.shadows.pcfKernelSize = 3;
  view.effects.shadows.resolution = 2048;
  view.effects.shadows.direction = [-0.45, -0.35, -0.85];

  view.lights.ibl.intensity = 0.9;
  view.lights.hemispheric.skyColor    = [0.78, 0.84, 0.95];
  view.lights.hemispheric.groundColor = [0.50, 0.42, 0.34];
  view.lights.hemispheric.worldUp = [0, 0, 1];
  // IBL is the dominant lighting contributor. Open it up to every
  // render mode so the navigation/fast paths aren't pitch-black —
  // without IBL a textureless PBR mesh under directional-only light
  // bottoms out in modes where shadows/SAO aren't running.
  view.lights.ibl.renderModes = [
    xeokit.base.constants.NavigationRender,
    xeokit.base.constants.DetailedRender,
    xeokit.base.constants.RealisticRender
  ];

  view.effects.tonemap.mode = "aces";

  view.effects.edges.renderModes = [];

  // The camera is fully controllable via Studio's default
  // ViewController — drag to orbit, scroll to zoom, keyboard arrows
  // pan/rotate (the controller's own bindings, intentionally NOT
  // intercepted here). The world doesn't auto-flow; instead, each
  // frame we pass the camera's current eye XY into the source and it
  // recycles whatever slots are now outside a window centred on the
  // camera. Stand still, no flow. Move forward, the city flows past.

  // Forward-fly state. Two triggers OR together — the InfoPanel's
  // "Fly forward" toggle latches the motion on/off, and Space
  // (held) does the same thing momentarily. The slider drives
  // `flySpeed` (metres per frame at 60 fps); both triggers honour
  // the current slider value. Per-frame translation runs inside
  // the input-stage task below.
  let flyActive = false;
  let spaceHeld = false;
  let flySpeed  = 3.0;
  window.addEventListener("keydown", (ev) => {
    if (ev.code === "Space" && !spaceHeld) {
      spaceHeld = true;
      ev.preventDefault();
    }
  });
  window.addEventListener("keyup", (ev) => {
    if (ev.code === "Space") spaceHeld = false;
  });

  // ── External instruction source ─────────────────────────────────
  // The source has no xeokit dependency — index.js is the bridge.
  const source = createLandscapeSource({
    slotCount:    SLOT_COUNT,
    windowWidth:  WINDOW_W,
    windowHeight: WINDOW_H,
    seed:         42
  });

  // ── Tiny status overlay ─────────────────────────────────────────
  const status = document.createElement("div");
  status.style.cssText =
    "position:absolute;top:12px;left:12px;padding:8px 12px;" +
    "background:rgba(0,0,0,0.55);color:#eee;font:13px/1.4 ui-sans-serif," +
    "system-ui,sans-serif;border-radius:4px;pointer-events:none;" +
    "user-select:none;max-width:340px";
  status.innerHTML =
    `<div><b>Infinite landscape</b> — ${SLOT_COUNT} pool slots, ` +
    `window ${WINDOW_W} × ${WINDOW_H} m</div>` +
    `<div style="margin-top:4px;opacity:0.85">` +
    `Camera: drag = orbit · right-drag = pan · scroll = zoom · ` +
    `arrow keys = pan/rotate · <b>Space (hold)</b> or info-panel ` +
    `toggle = fly forward` +
    `</div>` +
    `<div style="margin-top:2px;opacity:0.85">` +
    `Move the camera — the city recycles around you, deterministically.` +
    `</div>` +
    `<div id="camStatus" style="margin-top:4px;opacity:0.7;font-size:11px;` +
    `font-family:ui-monospace,monospace"></div>`;
  document.body.appendChild(status);
  const camStatus = status.querySelector("#camStatus");

  // ── Per-frame: pull instructions, write them to the pool ────────
  new xeokit.base.core.SDKTask({
    name: "Infinite landscape — apply instruction stream",
    repeat: true,
    stage: xeokit.base.core.SDKTask.CollectInputStage,
    task: () => {
      // Fly: when either the InfoPanel toggle is on or Space is
      // held, translate eye + look along the camera's forward
      // direction projected onto XY so altitude is preserved.
      // Done before reading eye for the landscape source so the
      // flow tracks the freshly-advanced position with no
      // one-frame lag.
      if ((flyActive || spaceHeld) && flySpeed > 0) {
        const cam = view.camera;
        const e = cam.eye;
        const l = cam.look;
        let fx = l[0] - e[0];
        let fy = l[1] - e[1];
        const flen = Math.hypot(fx, fy);
        if (flen > 1e-6) {
          fx = (fx / flen) * flySpeed;
          fy = (fy / flen) * flySpeed;
          cam.eye  = [e[0] + fx, e[1] + fy, e[2]];
          cam.look = [l[0] + fx, l[1] + fy, l[2]];
        }
      }

      // Source is camera-driven: pass the camera's eye XY and it
      // returns instructions for the slots that should be visible
      // around that point. Moving the camera causes recycling;
      // standing still produces no flow.
      const eye = view.camera.eye;
      const cx = eye[0], cy = eye[1];

      // Floor follows the camera so its edge is never visible.
      floorMesh.matrix = xeokit.model.scene.buildMat4({
        position: [cx, cy, -2.5],
        scale:    [FLOOR_SIZE, FLOOR_SIZE, 5]
      });

      const instructions = source.nextFrame(cx, cy);

      for (let k = 0; k < instructions.length; k++) {
        const ins = instructions[k];
        const previous = activeGeomBySlot[ins.slotId];

        // Hidden instruction — pattern doesn't fill this slot. Park
        // whichever mesh was previously active and move on.
        if (ins.hidden) {
          if (previous !== -1) {
            const old = sceneModel.meshes[`s${ins.slotId}_g${previous}`];
            if (old) old.matrix = PARK_MATRIX;
            activeGeomBySlot[ins.slotId] = -1;
          }
          continue;
        }

        const desired = ins.geomType;

        // Geom flipped — park the old mesh before activating the new.
        if (previous !== desired && previous !== -1) {
          const old = sceneModel.meshes[`s${ins.slotId}_g${previous}`];
          if (old) old.matrix = PARK_MATRIX;
        }

        // Active mesh: write transform + colour. Colour goes through
        // SceneMesh.color (not ViewObject.colorize) so the BRDF gets
        // it as the actual albedo input — colorize is a final-stage
        // multiplier and crushes to black in render modes where the
        // base BRDF output is dim. `buildMat4` composes a fresh
        // matrix every frame; cheap at this slot count.
        const mesh = sceneModel.meshes[`s${ins.slotId}_g${desired}`];
        if (!mesh) continue;
        mesh.matrix = xeokit.model.scene.buildMat4({
          position: ins.position,
          scale:    ins.scale,
          rotation: ins.rotation     // Euler XYZ — patterns can tilt around any axis
        });
        mesh.color = ins.color;

        // Opacity is a per-ViewObject concern; only push when it
        // actually deviates from fully-opaque so we don't churn the
        // colorize-flag bookkeeping on every frame.
        if (ins.opacity < 1.0) {
          const vobj = view.objects[`slot_${ins.slotId}`];
          if (vobj) vobj.opacity = ins.opacity;
        }

        activeGeomBySlot[ins.slotId] = desired;
      }

      camStatus.textContent =
        `camera eye = (${cx.toFixed(0)}, ${cy.toFixed(0)}, ${eye[2].toFixed(0)}) m`;
    }
  });


  const info = await studio.openInfoPanelFromMeta();
  info.addToggle({
    label:    "Fly forward",
    value:    flyActive,
    onChange: (on) => { flyActive = on; },
  });
  // Slider is metres-per-frame so the units match the per-frame
  // translation in the input-stage task. At 60 fps:
  //   1.0 m/frame =  60 m/s
  //   3.0 m/frame = 180 m/s (default)
  //  10.0 m/frame = 600 m/s
  info.addSlider({
    label:    "Speed (m/frame)",
    min:      0,
    max:      10,
    step:     0.1,
    value:    flySpeed,
    digits:   1,
    onChange: (v) => { flySpeed = v; },
  });

  studio.finished();
});

// In-place R_x(+π/2): (x, y, z) → (x, -z, y). Sends world +Y to world
// +Z and world +Z to world -Y — used at geometry-load time to stand
// the procedurally-built cylinder up.
function rotateXBy90(arr) {
  for (let i = 0; i < arr.length; i += 3) {
    const y = arr[i + 1];
    const z = arr[i + 2];
    arr[i + 1] = -z;
    arr[i + 2] = y;
  }
}

function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

// Deterministic, vivid per-slot starter colour. Same family as the
// runtime palette in landscape-source.js, so the swap to instruction-
// driven colours on the first tick isn't visually jarring.
function initialSlotColor(slot, geomType) {
  const tag = slot * 73856093 ^ geomType * 19349663 ^ 0xC0FFEE;
  const h = ((Math.sin(tag * 91.117) * 47453.5453) % 1 + 1) % 1;
  const s = 0.7;
  const l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if      (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else             { r = c; b = x; }
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

function mustBuild(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
