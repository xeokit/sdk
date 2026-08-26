// BIM / archviz demo: views a captured building interior as a 3D Gaussian
// Splatting scene (.splat, baked RGB, no spherical harmonics) via
// GaussianSplatLoader. This is the reality-capture / as-built side of a BIM
// workflow — a photoreal point-of-truth you can orbit alongside CAD geometry.
//
// Splats are a first-class SceneModel primitive (GaussianSplatsPrimitive): the
// loader builds a SceneModel geometry/mesh/object, MeshManager diverts it into
// the dedicated SplatBatch, and RenderManager draws it with the
// GaussianSplatTechnique (depth-sorted, alpha-blended billboards).
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

// Mip-NeRF 360 "room" interior, antimatter15 .splat format, subsampled to
// ~1.39M splats to fit the renderer's per-batch budget. Source dataset is
// research / non-commercial — swap in your own capture for production use.
const SPLAT_URL = "../../../../models/Train/splat/model.splat";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({

  });

  const status = document.getElementById("status");
  const caption = document.getElementById("caption");
  const setStatus = (text) => { if (status) status.textContent = text; };

  try {
    setStatus("Loading interior capture…");
    const resp = await fetch(SPLAT_URL);
    if (!resp.ok) {
      throw new Error(`Could not fetch ${SPLAT_URL} (HTTP ${resp.status})`);
    }
    const fileData = await resp.arrayBuffer();

    const sceneModelResult = scene.createModel({ id: "archvizScene" });
    if (!sceneModelResult.ok) {
      throw new Error(sceneModelResult.error);
    }
    const sceneModel = sceneModelResult.value;

    await new xeokit.formats.gaussiansplat.GaussianSplatLoader().load({ fileData, sceneModel });

    console.log(
      `[splat] loaded ${fileData.byteLength / 32} splats into ` +
      `${Object.keys(sceneModel.geometries).length} geometry / ` +
      `${Object.keys(sceneModel.objects).length} object`,
    );

    const aabb = studio.picking.collisionIndex.getSceneAABB();
    if (aabb) {
      studio.viewManager.fitToAabb(view, aabb);
    }

    if (status) status.style.display = "none";
    if (caption) caption.style.display = "";
    studio.finished();

    // --- Surface-position picking on splats ---------------------------------
    // Splats support picking exactly like triangle meshes: the splat pick pass
    // writes into the shared pick buffer (depth-tested against mesh geometry),
    // so clicking returns the picked ViewObject + the world-space surface
    // position of the nearest solid splat under the cursor.
    const pickInfo = document.getElementById("pickinfo");
    const fmt = (p) => `${p[0].toFixed(3)}, ${p[1].toFixed(3)}, ${p[2].toFixed(3)}`;
    view.htmlElement.addEventListener("click", (ev) => {
      const rect = view.htmlElement.getBoundingClientRect();
      const pick = studio.picking.picker.pick({
        view,
        canvasPos: [ev.clientX - rect.left, ev.clientY - rect.top],
      });
      if (pick.hit && pick.worldPos) {
        if (pickInfo) {
          pickInfo.style.display = "";
          pickInfo.textContent = `Picked ${pick.objectId} @ surface [${fmt(pick.worldPos)}]`;
        }
        console.log("[splat pick]", pick.objectId, pick.worldPos);
      } else if (pickInfo) {
        pickInfo.style.display = "";
        pickInfo.textContent = "No splat under cursor";
      }
    });

  } catch (err) {
    setStatus(`Failed to load .splat: ${err.message || err}`);
    console.error(err);
  }
});
