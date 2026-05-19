// Attach procedural IFC materials to a Schependomlaan SceneModel.
//
// Same pipeline as the Duplex companion example, on a far larger
// asset — Schependomlaan ships ~1500 SceneObjects spread across more
// than a dozen IFC types (IfcWall, IfcSlab, IfcCovering, IfcDoor,
// IfcWindow, IfcRailing, IfcStair, IfcBeam, IfcColumn, IfcMember,
// IfcFurnishingElement and more). The default painter table in
// `attachSceneModelMaterials` already covers all of those, so the
// example wires the asset up and lets the table handle the variety.
//
// Loads the source IFC directly via IFCLoader: a single 49 MB parse
// populates both the SceneModel (geometry) and the DataModel (IFC
// types + relationships) — the latter is what
// `attachSceneModelMaterials` reads to pick a painter per object.
// The bundled glb / xgf siblings are unsuitable here (committed
// copies were UTF-8-mangled at some point and won't parse).
//
// `viewFit` finishes by flying the camera to the Scene's BVH AABB so
// the example doesn't need a hand-tuned eye/look pair tied to this
// specific dataset.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const MODEL_BASE = "../../modelsProspective/Schependomlaan";

async function main() {

  const studio = new xeokit.studio.Studio({});
  await studio.init();

  const { scene, data } = studio;

  // ── DataModel + SceneModel populated from the Schependomlaan IFC.

  const dataModelResult = data.createModel({ id: "schependomlaan" });
  if (!dataModelResult.ok) throw new Error(dataModelResult.error);
  const dataModel = dataModelResult.value;

  const sceneModelResult = scene.createModel({
    id: "schependomlaan",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
  const sceneModel = sceneModelResult.value;

  // Single IFC parse, fed into both SceneModel (geometry) and
  // DataModel (IFC types + relationships). The DataModel side is
  // what `attachSceneModelMaterials` needs to pick a painter per
  // SceneObject.
  const ifcLoader = new xeokit.formats.ifc.IFCLoader();
  const ifcResponse = await fetch(`${MODEL_BASE}/ifc/model.ifc`);
  if (!ifcResponse.ok) {
    throw new Error(`HTTP ${ifcResponse.status} fetching ${MODEL_BASE}/ifc/model.ifc`);
  }
  const ifcData = await ifcResponse.arrayBuffer();
  await ifcLoader.load({ fileData: ifcData, sceneModel, dataModel });

  // ── Attach procgen IFC materials in place. Reads each
  // SceneObject's IFC type from the DataModel and binds the matching
  // painter's textures + SceneMaterial to that object's SceneMeshes.
  // Materials and textures are added to the same SceneModel.
  //
  // Schependomlaan stores the roof cladding as `IfcCovering`s named
  // with the Dutch prefix "dak" (roof) — same IFC type as the wall
  // and floor coverings. Discriminate by name in `resolveIfcType` so
  // those 67 roof coverings get routed to the synthetic
  // `IfcCovering_Roof` key (mapped to `paintCopperRoof`) while the
  // remaining ~1200 IfcCoverings keep their default plaster.
  //
  // applyIFCMaterials is async — texture generation streams through
  // the progress reporter. Await the result so the SDKResult check
  // sees a resolved value (without await, the returned Promise's
  // `.ok` is undefined and the throw fires every time, killing the
  // createView + viewFit calls that follow).
  const attachResult = await xeokit.studio.applyIFCMaterials.applyIFCMaterials({
    sceneModel,
    dataModel,
    textureSize: 256,
    painters: {
      IfcCovering_Roof: {
        paint: xeokit.model.procgen.paintMaterials.paintCopperRoof,
        material: { color: [1.0, 1.0, 1.0] }
      }
    },
    resolveIfcType: (_objId, dataObj) => {
      if (!dataObj) return undefined;
      if (dataObj.type === "IfcCovering" && /(^|[^a-z])dak/i.test(dataObj.name || "")) {
        return "IfcCovering_Roof";
      }
      return undefined;
    }
  });
  if (!attachResult.ok) throw new Error(attachResult.error);


  // ── View, lighting, HDR IBL.

  const view = studio.viewManager.createView({
    renderMode: xeokit.base.constants.RealisticRender,
    effects: {
      tonemap: { sRGBEncode: true }
    }
  });

  studio.viewFit(view);
  studio.finished();
}

main().catch(err => {
  console.error("[AttachSceneModelMaterials_Schependomlaan]", err);
});


