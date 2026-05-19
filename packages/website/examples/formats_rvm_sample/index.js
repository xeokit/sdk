// Loads an AVEVA RVM file through RVMLoader.
//
// Two paths, transparently selected:
//
//   1. Drop a real `.rvm` at `models/RVM_Sample/rvm/model.rvm` and
//      this example fetches and loads it directly. This is the
//      "production" path — point it at a real plant export.
//
//   2. If that file is missing (404) the example synthesises a tiny
//      "plant skid" RVM byte stream in-memory using the rvm module's
//      ChunkWriter — a ground plate (Box), four columns (Cylinders),
//      and four valve heads (Spheres) — then loads those bytes. The
//      synthesis path makes the demo self-contained and exercises
//      every supported primitive decoder (box, cylinder, sphere).
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const RVM_URL  = "../../models/RVM_Sample/rvm/model.rvm";
const COORD_SYS_URL = "../../models/RVM_Sample/coordSys.json";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [12, 8, 12],
      look: [0, 1, 0],
      up:   [0, 1, 0]
    },
    effects: {
      edges: { renderModes: [] }
    }
  });

  const QR = xeokit.base.constants.DetailedRender;

  view.effects.sao.renderModes = [QR];
  view.effects.sao.intensity = 0.25;
  view.effects.sao.kernelRadius = 60;

  view.effects.shadows.renderModes = [QR];
  view.effects.shadows.intensity = 0.55;
  view.effects.shadows.cascadeCount = 3;
  view.effects.shadows.pcfKernelSize = 3;
  view.effects.shadows.resolution = 2048;
  view.effects.shadows.direction = [-0.45, -0.35, -0.80];

  view.lights.ibl.intensity = 0.5;
  view.lights.hemispheric.skyColor    = [0.62, 0.72, 0.86];
  view.lights.hemispheric.groundColor = [0.42, 0.36, 0.30];
  view.lights.hemispheric.worldUp = sunUpFromDir(view.effects.shadows.direction);

  view.effects.tonemap.mode = "aces";
  view.effects.tonemap.exposure = 1.0;

  const status = document.getElementById("status");

  try {
    const rvmBytes = await getOrSynthRVM(status);

    // Coordinate system comes from the model dir's coordSys.json so
    // the convention is checked in alongside the asset. AVEVA RVM is
    // Z-up by convention; the JSON encodes the Z-up→Y-up basis swap
    // for xeokit's default Y-up scene.
    const coordSysResp = await fetch(COORD_SYS_URL);
    const coordinateSystem = coordSysResp.ok
      ? await coordSysResp.json()
      : { basis: [1, 0, 0,  0, 1, 0,  0, 0, 1], origin: [0, 0, 0], units: "meters" };

    const sceneModel = mustCreate(scene.createModel({
      id: "rvmSample",
      coordinateSystem
    }));

    const rvmLoader = new xeokit.formats.rvm.RVMLoader();
    await rvmLoader.load({ fileData: rvmBytes, sceneModel });

    // Post-load summary so we can confirm geometry actually landed and
    // figure out a sensible camera framing. Walks every mesh's
    // geometry, transforms its AABB into world space, and unions
    // them all. If this prints "no aabb" the model never produced
    // geometry — check the parser's own diagnostic log above.
    const objCount = Object.keys(sceneModel.objects).length;
    const meshCount = Object.keys(sceneModel.meshes).length;
    const geomCount = Object.keys(sceneModel.geometries).length;
    const aabb = computeWorldAABB(sceneModel);
    console.log(`[RVMSample] sceneModel: ${objCount} objects, ${meshCount} meshes, ${geomCount} geometries`);
    console.log("[RVMSample] world AABB:", aabb);
    if (aabb) frameCameraTo(view, aabb);

    status.style.display = "none";
    studio.finished();
  } catch (err) {
    status.textContent = `Failed to load RVM: ${err.message || err}`;
    console.error(err);
  }
});

// ---------------------------------------------------------------------
// Pulls the persistent .rvm file when present; otherwise synthesises
// a small plant-skid layout in-memory using ChunkWriter so the example
// always renders something.
// ---------------------------------------------------------------------
async function getOrSynthRVM(status) {
  const resp = await fetch(RVM_URL);
  if (resp.ok) {
    status.textContent = "Loading RVM file…";
    return resp.arrayBuffer();
  }

  status.textContent = "RVM not found — building synthetic sample…";
  return synthesisePlantSkid();
}

// Build a small RVM v2 file in-memory containing a layout of boxes,
// cylinders, and spheres. Showcases the loader's primitive decoders.
//
// All length values are written in millimetres to match the AVEVA
// convention — the loader scales them back to metres at read time.
function synthesisePlantSkid() {
  const { ChunkWriter, RVMPrimitive } = xeokit.formats.rvm;
  const writer = new ChunkWriter();
  const MM = 1000; // metres → millimetres

  // ── HEAD ────────────────────────────────────────────────────────
  writer.writeChunkHeader("HEAD", 1);
  writer.writeString("xeokit-sample");                 // info
  writer.writeString("Synthetic plant-skid demo");     // note
  writer.writeString(new Date().toISOString());        // date
  writer.writeString("xeokit");                        // user
  writer.writeString("UTF-8");                         // encoding

  // ── MODL ────────────────────────────────────────────────────────
  writer.writeChunkHeader("MODL", 1);
  writer.writeString("PlantSkid");
  writer.writeString("PlantSkid");

  // ── Colour palette ──────────────────────────────────────────────
  // Three palette entries; matching CNTB materialIds below pick them
  // up. Without these the loader falls back to a hashed colour, but
  // emitting COLR exercises the palette path end-to-end.
  emitColor(writer, 1, [0xc8, 0x9d, 0x5a]);   // ground — warm tan
  emitColor(writer, 2, [0x8e, 0x9c, 0xb0]);   // columns — bluish steel
  emitColor(writer, 3, [0xd6, 0x44, 0x36]);   // valves — red

  // ── Top-level CNTB ──────────────────────────────────────────────
  writer.writeChunkHeader("CNTB", 1);
  writer.writeString("Skid");
  writer.writeFloat32(0); writer.writeFloat32(0); writer.writeFloat32(0);
  writer.writeInt32(0);                        // inherit (no material)

  // ── Ground CNTB (materialId 1) ──────────────────────────────────
  writer.writeChunkHeader("CNTB", 1);
  writer.writeString("Ground");
  writer.writeFloat32(0); writer.writeFloat32(0); writer.writeFloat32(0);
  writer.writeInt32(1);
  emitBoxPrim(writer, RVMPrimitive, MM,
    /*translation*/ [0, 0, 0],
    /*aabb*/ [-4, -0.05, -4, 4, 0.05, 4],
    /*extents*/ [8, 0.1, 8]);
  writer.writeChunkHeader("CNTE", 1);

  // ── Columns CNTB (materialId 2) — four 0.4m × 3m cylinders ──────
  writer.writeChunkHeader("CNTB", 1);
  writer.writeString("Columns");
  writer.writeFloat32(0); writer.writeFloat32(0); writer.writeFloat32(0);
  writer.writeInt32(2);
  const colY = 1.5;
  for (const [cx, cz] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) {
    emitCylinder(writer, RVMPrimitive, MM, [cx, colY, cz], 0.4, 3.0);
  }
  writer.writeChunkHeader("CNTE", 1);

  // ── Valves CNTB (materialId 3) — spheres on top of each column ──
  writer.writeChunkHeader("CNTB", 1);
  writer.writeString("Valves");
  writer.writeFloat32(0); writer.writeFloat32(0); writer.writeFloat32(0);
  writer.writeInt32(3);
  for (const [cx, cz] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) {
    emitSphere(writer, RVMPrimitive, MM, [cx, 3.3, cz], 0.6);
  }
  writer.writeChunkHeader("CNTE", 1);

  writer.writeChunkHeader("CNTE", 1);
  writer.writeChunkHeader("END", 1);

  return writer.finish();
}

function emitColor(writer, index, [r, g, b]) {
  writer.writeChunkHeader("COLR", 1);
  writer.writeUint32(index);
  // Pack RGBA into a big-endian uint32: byte order [R, G, B, A].
  writer.writeUint32(((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | 0xff);
}

function emitBoxPrim(writer, RVMPrimitive, MM, translation, aabb, extents) {
  writer.writeChunkHeader("PRIM", 1);
  writer.writeUint32(RVMPrimitive.Box);
  writeIdentityMatrix(writer, translation, MM);
  for (const v of aabb) writer.writeFloat32(v * MM);
  writer.writeFloat32(extents[0] * MM);
  writer.writeFloat32(extents[1] * MM);
  writer.writeFloat32(extents[2] * MM);
}

function emitCylinder(writer, RVMPrimitive, MM, translation, radius, height) {
  writer.writeChunkHeader("PRIM", 1);
  writer.writeUint32(RVMPrimitive.Cylinder);
  writeIdentityMatrix(writer, translation, MM);
  writer.writeFloat32((translation[0] - radius) * MM);
  writer.writeFloat32((translation[1] - height / 2) * MM);
  writer.writeFloat32((translation[2] - radius) * MM);
  writer.writeFloat32((translation[0] + radius) * MM);
  writer.writeFloat32((translation[1] + height / 2) * MM);
  writer.writeFloat32((translation[2] + radius) * MM);
  writer.writeFloat32(radius * MM);
  writer.writeFloat32(height * MM);
}

function emitSphere(writer, RVMPrimitive, MM, translation, radius) {
  writer.writeChunkHeader("PRIM", 1);
  writer.writeUint32(RVMPrimitive.Sphere);
  writeIdentityMatrix(writer, translation, MM);
  writer.writeFloat32((translation[0] - radius) * MM);
  writer.writeFloat32((translation[1] - radius) * MM);
  writer.writeFloat32((translation[2] - radius) * MM);
  writer.writeFloat32((translation[0] + radius) * MM);
  writer.writeFloat32((translation[1] + radius) * MM);
  writer.writeFloat32((translation[2] + radius) * MM);
  writer.writeFloat32(radius * 2 * MM);
}

function writeIdentityMatrix(writer, translation, MM) {
  // Column-major 3x4 — three rotation columns + translation column.
  // Translation written in millimetres to match the AVEVA convention
  // (the loader scales it back at read time).
  writer.writeFloat32(1); writer.writeFloat32(0); writer.writeFloat32(0);
  writer.writeFloat32(0); writer.writeFloat32(1); writer.writeFloat32(0);
  writer.writeFloat32(0); writer.writeFloat32(0); writer.writeFloat32(1);
  writer.writeFloat32(translation[0] * MM);
  writer.writeFloat32(translation[1] * MM);
  writer.writeFloat32(translation[2] * MM);
}

function sunUpFromDir(dir) {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  return [-dir[0] / len, -dir[1] / len, -dir[2] / len];
}

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

// Walks every mesh, transforms its geometry AABB by the mesh matrix,
// and unions the result. Returns null if nothing renderable exists.
function computeWorldAABB(sceneModel) {
  let minX = +Infinity, minY = +Infinity, minZ = +Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let any = false;
  for (const meshId in sceneModel.meshes) {
    const mesh = sceneModel.meshes[meshId];
    const g = mesh.geometry;
    if (!g || !g.aabb) continue;
    const m = mesh.matrix;
    // 8 corners of the geometry AABB transformed by the mesh matrix.
    for (let i = 0; i < 8; i++) {
      const x = (i & 1) ? g.aabb[3] : g.aabb[0];
      const y = (i & 2) ? g.aabb[4] : g.aabb[1];
      const z = (i & 4) ? g.aabb[5] : g.aabb[2];
      const wx = m[0]*x + m[4]*y + m[8] *z + m[12];
      const wy = m[1]*x + m[5]*y + m[9] *z + m[13];
      const wz = m[2]*x + m[6]*y + m[10]*z + m[14];
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
      any = true;
    }
  }
  return any ? [minX, minY, minZ, maxX, maxY, maxZ] : null;
}

// Pulls the camera back to a 3/4 view that comfortably frames the
// supplied AABB. Distance is keyed off the AABB diagonal so plant
// models on any scale (mm-stuck or millions-of-metres) end up visible.
function frameCameraTo(view, aabb) {
  const cx = (aabb[0] + aabb[3]) * 0.5;
  const cy = (aabb[1] + aabb[4]) * 0.5;
  const cz = (aabb[2] + aabb[5]) * 0.5;
  const dx = aabb[3] - aabb[0];
  const dy = aabb[4] - aabb[1];
  const dz = aabb[5] - aabb[2];
  const r  = Math.max(1, 0.5 * Math.hypot(dx, dy, dz));
  view.camera.eye  = [cx + r * 1.2, cy + r * 0.8, cz + r * 1.2];
  view.camera.look = [cx, cy, cz];
  view.camera.up   = [0, 1, 0];
}
