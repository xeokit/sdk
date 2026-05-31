// Apply procedural heat-map materials to an IfcOpenHouse4 SceneModel.
//
// Loads the source IFC into a SceneModel + DataModel, then runs
// `applyHeatMapMaterials` to paint a per-geometry heat map onto
// every triangle SceneObject. The default scalar field — vertex
// elevation along the SceneModel's worldUp axis — gives a smooth
// vertical gradient from the foundation (cool blue) to the roof tip
// (hot red), normalised against the union range of every painted
// geometry so the gradient reads as a single continuous scale across
// the whole house.
//
// `applyHeatMapMaterials` writes the painted UVs straight onto each
// SceneGeometry, creates the three SceneTextures (colour, normal, mr)
// and a SceneMaterial per geometry, then snapshot-destroy-recreates
// the SceneObject's meshes bound to the new materials. Mesh
// transforms / opacity / parent-transform bindings are preserved.
//
// Companion to AttachSceneModelMaterials_* — same pipeline shape, but
// per-geometry instead of per-IFC-type, and the texture content is
// a function of the geometry rather than a tileable pattern.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

async function main() {

    const studio = new xeokit.studio.Studio({});
    await studio.init();

    const { scene, data } = studio;

    // ── DataModel + SceneModel populated from the IfcOpenHouse4 IFC.

    const dataModelResult = data.createModel({ id: "ifcOpenHouse4" });
    if (!dataModelResult.ok) throw new Error(dataModelResult.error);
    const dataModel = dataModelResult.value;

    const sceneModelResult = scene.createModel({
        id: "ifcOpenHouse4",
        coordinateSystem: {
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            origin: [0, 0, 0],
            units: "meters"
        }
    });
    if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
    const sceneModel = sceneModelResult.value;

    const ifcLoader = new xeokit.formats.ifc.IFCLoader();
    const ifcResponse = await fetch("../../models/IfcOpenHouse4/ifc/model.ifc");
    if (!ifcResponse.ok) {
        throw new Error(`HTTP ${ifcResponse.status} fetching IfcOpenHouse4 IFC`);
    }
    const ifcData = await ifcResponse.arrayBuffer();
    await ifcLoader.load({ fileData: ifcData, sceneModel, dataModel });

    // ── Paint per-geometry heat maps in place.
    //
    // Defaults shown explicitly so the example is self-documenting:
    //
    //   • scalars      — left as default (vertex elevation along
    //                    sceneModel.coordinateSystem.worldUp)
    //   • range        — left as default (union min/max across all
    //                    painted geometries — every geometry shares
    //                    the same scale, so a wall halfway up the
    //                    house reads as the same "warmth" as a slab
    //                    at the same height elsewhere)
    //   • textureSize  — default 512 px (the renderer doesn't mipmap
    //                    scene textures, so a larger base level helps
    //                    suppress minification moiré on dense roofs)
    //   • ramp         — DEFAULT_HEATMAP_RAMP (blue → cyan → green →
    //                    yellow → red)
    //   • roughness    — 0.6 (matte, picks up SAO + IBL cleanly)
    const paintResult = xeokit.presentations.heatmaps.applyHeatMapMaterials({
        sceneModel,
        roughness: 0.6,
        // Debug grid overlay so the planar UV projection is visible —
        // every heat map shows how its geometry was laid out in
        // texture space, with one cell per ~1/16 of the AABB extent.
        grid: true
    });
    if (!paintResult.ok) throw new Error(paintResult.error);


    // ── View, lighting, HDR IBL.

    const view = studio.viewManager.createView({
        renderMode: xeokit.base.constants.RealisticRender,
        effects: {
            tonemap: { sRGBEncode: true }
        }
    });

    studio.viewManager.fitToAabb(view, studio.picking.collisionIndex.getSceneAABB());
    studio.openInfoPanelFromMeta();
    studio.finished();

    // ── Interactive brush.
    //
    // Click-drag to paint white onto the heat-map texture of whichever
    // SceneMesh the cursor lands on. Pipeline:
    //
    //   1. SceneRaycaster turns the canvas pointer into a world-space ray
    //      and returns the first hit (objectId, meshId, worldPos).
    //   2. The matching SceneMesh is looked up on its SceneObject.
    //   3. paintHeatMapPoint inverts the mesh's worldMatrix to bring the
    //      hit into local space, planar-projects onto the same UV axes
    //      paintHeatMap chose, and splats a circular brush of texels.
    //   4. The painter calls texture.notifyImageDataChanged(), which
    //      fires the new onSceneTextureImageDataChanged event; the
    //      renderer's atlas re-uploads just the affected sub-rect via
    //      texSubImage2D — no batch / mesh / material rebuild.
    //   5. view.needsRender() schedules a redraw so the change shows up
    //      next frame.
    const picker = new xeokit.spatial.collision.SceneRaycaster(scene);

    const findSceneMesh = (objectId, meshId) => {
        const obj = sceneModel.objects[objectId];
        if (!obj) return null;
        for (const m of obj.meshes) if (m.id === meshId) return m;
        return null;
    };

    const canvasPos = [0, 0];
    const canvas = view.htmlElement;
    let painting = false;

    const paintAt = (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        canvasPos[0] = clientX - rect.left;
        canvasPos[1] = clientY - rect.top;
        const result = picker.pick({ view, canvasPos });
        if (!result.ok) return;
        const r = result.value;
        if (!r.hit) return;
        const sceneMesh = findSceneMesh(r.objectId, r.meshId);
        if (!sceneMesh) return;
        const paint = xeokit.presentations.heatmaps.paintHeatMapPoint({
            sceneMesh,
            worldPos: r.worldPos,
            color: [1, 1, 1],   // white brush
            radius: 16,         // 16 texels ≈ half a grid cell at size=512
            opacity: 1.0,
            falloff: 1.5
        });
        if (!paint.ok) {
            console.warn("[paintHeatMapPoint]", paint.error);
        }
        // No view.needsRender() needed — assigning through
        // texture.imageData (which paintHeatMapPoint does internally)
        // fires onSceneTextureImageDataChanged, which the renderer
        // routes through ViewManager.sceneTextureImageDataChanged →
        // queues the atlas re-upload AND schedules a redraw.
    };

    canvas.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        painting = true;
        paintAt(e.clientX, e.clientY);
    });
    canvas.addEventListener("mousemove", (e) => {
        if (painting) paintAt(e.clientX, e.clientY);
    });
    const stopPainting = () => { painting = false; };
    canvas.addEventListener("mouseup",    stopPainting);
    canvas.addEventListener("mouseleave", stopPainting);
}

main().catch(err => {
    console.error("[PaintSceneModelHeatMaps_IfcOpenHouse4]", err);
});
