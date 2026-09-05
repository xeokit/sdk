import * as presentations from "@xeokit/website-presentations";
import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {SceneRaycaster} from "@xeokit/sdk/spatial/collision";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {createExampleRenderer, failExample, fetchArrayBuffer, finishExample, mustElement, mustOk} from "../../../utils/standaloneRuntime.js";
import {createModelNavigationPick, fitViewToScene, IDENTITY_COORDINATE_SYSTEM} from "../../../utils/workflowRuntime.js";
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

async function main() {

    const data = new Data();
    const scene = new Scene();
    const viewer = new Viewer({scene});
    const view = mustOk(viewer.createView({
        id: "demoView",
        htmlElement: mustElement("demoCanvas"),
        effects: {
            tonemap: { sRGBEncode: true }
        }
    }));
    const renderer = await createExampleRenderer(viewer);
    const navPicker = new RoutingPickStrategy(scene, renderer);
    const inputController = new ModelNavigationController(view, {
        pick: createModelNavigationPick(view, navPicker)
    });

    // ── DataModel + SceneModel populated from the IfcOpenHouse4 IFC.
    //
    // The model catalog sidecar declares IfcOpenHouse4 in metre-based
    // identity coordinates. Declare that basis on the SceneModel so the
    // IFC load and the heat-map world-up sampling use the intended frame.

    const dataModel = mustOk(data.createModel({ id: "ifcOpenHouse4" }));
    const sceneModel = mustOk(scene.createModel({
        id: "ifcOpenHouse4",
        coordinateSystem: IDENTITY_COORDINATE_SYSTEM,
        updateHint: "static"
    }));

    const loadResult = await new IFCLoader().load({
        fileData: await fetchArrayBuffer("../../../../models/IfcOpenHouse4/ifc/model.ifc"),
        sceneModel,
        dataModel
    });
    if (loadResult && loadResult.ok === false) {
        throw new Error(loadResult.error);
    }

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
    const paintResult = presentations.heatmaps.applyHeatMapMaterials({
        sceneModel,
        roughness: 0.6,
        // Debug grid overlay so the planar UV projection is visible —
        // every heat map shows how its geometry was laid out in
        // texture space, with one cell per ~1/16 of the AABB extent.
        grid: true
    });
    if (!paintResult.ok) throw new Error(paintResult.error);


    fitViewToScene(view, scene);
    finishExample(renderer, view);

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
    //   5. The texture change invalidates rendering automatically.
    const picker = new SceneRaycaster(scene);

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
        const paint = presentations.heatmaps.paintHeatMapPoint({
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
        // Assigning through texture.imageData (which paintHeatMapPoint
        // does internally) fires onSceneTextureImageDataChanged. The
        // renderer queues the atlas re-upload and redraw automatically.
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

main().catch((error) => failExample("workflows/heatmaps/ifc-open-house4", error));
