// Loads and views a binary Autodesk FBX file.
//
// FBX is not one of the formats the loader registry recognises, so we drive
// FBXLoader directly: fetch the .fbx bytes, create a SceneModel, and hand both
// to the loader. The sample (models/FBX_Sample/model.fbx) is four cubes that
// share one geometry, each with its own transform and material — exercising the
// loader's geometry, instancing, transform, and material paths.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const FBX_URL = "../../models/E3D_Plant/fbx/model.fbx";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [5, 4, 5],
      look: [0, 0.5, 0],
      up:   [0, 1, 0]
    }
  });



  const status = document.getElementById("status");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading FBX…");
    const resp = await fetch(FBX_URL);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${FBX_URL} (HTTP ${resp.status})`);
    }
    const fileData = await resp.arrayBuffer();

    // FBX is Y-up here, matching xeokit's default Y-up scene → identity basis.
    const sceneModelResult = scene.createModel({
      id: "fbxSample",
      coordinateSystem: {
        basis:  [1, 0, 0,  0, 0, 1,  0, 1, 0],
        origin: [0, 0, 0],
        units:  "meters",
        scaleToMeters: 1
      }
    });
    if (!sceneModelResult.ok) {
      throw new Error(sceneModelResult.error);
    }
    const sceneModel = sceneModelResult.value;

    await new xeokit.formats.fbx.FBXLoader().load({ fileData, sceneModel });

    console.log(
      `[FBX] loaded ${Object.keys(sceneModel.objects).length} objects, ` +
      `${Object.keys(sceneModel.meshes).length} meshes, ` +
      `${Object.keys(sceneModel.geometries).length} geometries`,
    );

    const aabb = computeWorldAABB(sceneModel);
    if (aabb) {
      frameCameraTo(view, aabb);
    }

    if (status) status.style.display = "none";
    studio.finished();

  } catch (err) {
    setStatus(`Failed to load FBX: ${err.message || err}`);
    console.error(err);
  }
});

// Unions every mesh's geometry AABB transformed into world space.
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

// Pulls the camera back to a 3/4 view that comfortably frames the AABB.
function frameCameraTo(view, aabb) {
  const cx = (aabb[0] + aabb[3]) * 0.5;
  const cy = (aabb[1] + aabb[4]) * 0.5;
  const cz = (aabb[2] + aabb[5]) * 0.5;
  const dx = aabb[3] - aabb[0];
  const dy = aabb[4] - aabb[1];
  const dz = aabb[5] - aabb[2];
  const r  = Math.max(1, 0.5 * Math.hypot(dx, dy, dz));
  view.camera.eye  = [cx + r * 1.3, cy + r * 1.0, cz + r * 1.3];
  view.camera.look = [cx, cy, cz];
  view.camera.up   = [0, 0, 1];
}
