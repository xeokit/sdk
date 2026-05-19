// Loads an ISO 10303-21 STEP file through STEPLoader.
//
// Two paths, transparently selected:
//
//   1. Drop a real `.step` / `.stp` at `models/STEP_Sample/step/model.step`
//      and the example fetches it directly. This is the "production"
//      path — point it at any STEP export from your favourite MCAD
//      tool (CATIA, NX, SolidWorks, Creo, …).
//
//   2. If that file is missing (404) the example synthesises a small
//      AP214 fragment in-memory containing six `PRODUCT(...)`
//      instances. Synthesis is trivial because STEP is plain ASCII —
//      we just template-string the HEADER + DATA blocks. The synth
//      path makes the demo self-contained and exercises the loader's
//      HEADER + PRODUCT extraction end-to-end.
//
// Today the loader stages each PRODUCT as a placeholder cube on a
// √n×√n grid — the SceneObject identity / hierarchy / pickability
// are all real, the geometry is a stand-in until the B-Rep
// tessellator that replaces them with the file's real shapes lands.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const STEP_URL = "../../models/STEP_Sample/stp/model.stp";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const {scene, data} = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [6, 4, 6],
      look: [0, 0.5, 0],
      up:   [0, 1, 0]
    },
    effects: {
      edges: {renderModes: []}
    }
  });

  const QR = xeokit.base.constants.DetailedRender;

  view.effects.sao.renderModes = [QR];
  view.effects.sao.intensity = 0.25;
  view.effects.sao.kernelRadius = 60;

  view.effects.tonemap.mode = "aces";
  view.effects.tonemap.exposure = 1.0;

  view.lights.ibl.intensity = 0.5;
  view.lights.hemispheric.skyColor    = [0.62, 0.72, 0.86];
  view.lights.hemispheric.groundColor = [0.42, 0.36, 0.30];

  const status = document.getElementById("status");

  try {
    const stepText = await getOrSynthSTEP(status);

    const sceneModel = mustCreate(scene.createModel({id: "stepSample"}));
    const dataModel  = mustCreate(data.createModel({id: "stepSample"}));

    const stepLoader = new xeokit.formats.step.STEPLoader();
    await stepLoader.load({fileData: stepText, sceneModel, dataModel});

    const objCount  = Object.keys(sceneModel.objects).length;
    const meshCount = Object.keys(sceneModel.meshes).length;
    const geomCount = Object.keys(sceneModel.geometries).length;
    const dataObjCount = Object.keys(dataModel.objects).length;
    console.log(`[STEPSample] sceneModel: ${objCount} objects, ${meshCount} meshes, ${geomCount} geometries`);
    console.log(`[STEPSample] dataModel: ${dataObjCount} dataObjects`);

    const aabb = computeWorldAABB(sceneModel);
    console.log("[STEPSample] world AABB:", aabb);
    if (aabb) frameCameraTo(view, aabb);

    status.textContent =
      `Loaded ${objCount} PRODUCT${objCount === 1 ? "" : "s"} ` +
      `(placeholder cubes — real geometry pending the B-Rep walker)`;
    studio.finished();
  } catch (err) {
    status.textContent = `Failed to load STEP: ${err && err.message || err}`;
    console.error(err);
  }
});


// ---------------------------------------------------------------------
// Pulls the persistent .step file when present; otherwise synthesises
// a small AP214 fragment in-memory so the example always renders.
// ---------------------------------------------------------------------
async function getOrSynthSTEP(status) {
  let resp;
  try {
    resp = await fetch(STEP_URL);
  } catch {
    resp = null;
  }
  if (resp && resp.ok) {
    status.textContent = "Loading STEP file…";
    return resp.text();
  }

  status.textContent = "STEP not found — building synthetic AP214 sample…";
  return synthesiseSampleStep();
}

// Build a minimal AP214 STEP file containing six PRODUCT instances.
// STEP being plain ASCII makes synthesis trivial — we just
// template-string the HEADER + DATA blocks.
//
// `FILE_SCHEMA(('AUTOMOTIVE_DESIGN ...'))` routes the loader's
// version dispatch to the AP214 parser. The payload entities are
// otherwise minimal — six `PRODUCT('id','name','desc',...)` lines
// is all the loader needs for SceneObject creation right now.
function synthesiseSampleStep() {
  const stamp = new Date().toISOString();
  const products = [
    {id: "PART-001", name: "Bracket A",   desc: "left mounting bracket"},
    {id: "PART-002", name: "Bracket B",   desc: "right mounting bracket"},
    {id: "PART-003", name: "Pin",         desc: "M6 dowel pin"},
    {id: "PART-004", name: "Cover",       desc: "top cover plate"},
    {id: "PART-005", name: "Base",        desc: "weld base"},
    {id: "PART-006", name: "Fastener",    desc: "M6 bolt"},
  ];
  const productLines = products.map((p, i) => {
    const ref = 100 + i;
    return `#${ref}=PRODUCT('${p.id}','${p.name}','${p.desc}',(#10));`;
  }).join("\n");
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('xeokit STEP smoke-test fragment'),'2;1');
FILE_NAME('synthetic.step','${stamp}',('xeokit'),(''),'STEPLoader_Sample','xeokit','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
#1=APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#2);
#2=APPLICATION_CONTEXT('mechanical design');
#10=PRODUCT_CONTEXT('part definition',#2,'mechanical');
${productLines}
ENDSEC;
END-ISO-10303-21;
`;
}


// ---------------------------------------------------------------------
// Small helpers — same shape as the matching pieces in
// RVMLoader_Sample so the two examples read consistently.
// ---------------------------------------------------------------------

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

// Walks every mesh, transforms its geometry AABB by the mesh matrix,
// and unions the corners into a world-space AABB. Returns null if no
// mesh has geometry — useful diagnostic for "the load did nothing".
function computeWorldAABB(sceneModel) {
  let minX = +Infinity, minY = +Infinity, minZ = +Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let any = false;
  for (const meshId in sceneModel.meshes) {
    const mesh = sceneModel.meshes[meshId];
    const g = mesh.geometry;
    if (!g || !g.aabb) continue;
    const m = mesh.matrix;
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
// supplied AABB. Distance is keyed off the AABB diagonal so models
// on any scale end up visible.
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
