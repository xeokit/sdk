// Paint heat-map materials onto a Duplex SceneModel.
//
// Companion to PaintSceneModelHeatMaps_IfcOpenHouse4 — same pipeline,
// larger asset. Loads Duplex from its precomputed XGF + datamodel
// JSON (cheaper than reparsing the IFC at runtime — Duplex is
// ~300 SceneObjects), then `applyHeatMapMaterials` walks every
// triangle geometry and bakes a heat map driven by vertex elevation
// along the SceneModel's worldUp axis. The result is a continuous
// blue → red gradient across the whole building, with each level's
// slabs sitting at the same temperature.
//
// After the initial bake, click + drag to paint white onto whichever
// surface the cursor hits — `paintHeatMapPoint` projects the
// world-space hit back into the geometry's local frame, splats a
// circular brush of texels into the existing heat-map ImageData, and
// fires the SceneTexture's change event. The renderer's atlas
// re-uploads only the affected sub-rect via `texSubImage2D`, so
// brushing is essentially free per click.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const MODEL_BASE = "../../models/Duplex";

async function main() {

    const studio = new xeokit.studio.Studio({});
    await studio.init();

    const { scene, data } = studio;

    // ── DataModel + SceneModel populated from the Duplex assets.
    //
    // Duplex is authored Y-up; the Scene is Z-up by default. Declaring the
    // model basis here keeps the loaded building upright in scene space.
    const dataModelResult = data.createModel({ id: "duplex" });
    if (!dataModelResult.ok) throw new Error(dataModelResult.error);
    const dataModel = dataModelResult.value;

    const sceneModelResult = scene.createModel({
        id: "duplex",
        coordinateSystem: {
            basis: [
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            ],
            origin: [0, 0, 0],
            units: "meters",
            scaleToMeters: 1
        }
    });
    if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
    const sceneModel = sceneModelResult.value;

    await studio.loadModel({
        id: "duplex",
        src: `${MODEL_BASE}/datamodel/model.json`,
        format: "datamodel",
        dataModel
    });

    await studio.loadModel({
        id: "duplex",
        src: `${MODEL_BASE}/xgf/model.xgf`,
        format: "xgf",
        sceneModel
    });

    // ── Bake per-geometry heat maps in place.
    //
    //   • scalars      — default (vertex elevation along worldUp).
    //   • range        — default (union min/max across every painted
    //                    geometry, so a slab on the upper floor reads
    //                    as the same warmth as the upper portion of a
    //                    wall on that floor).
    //   • textureSize  — default 512 px.
    //   • ramp         — DEFAULT_HEATMAP_RAMP (blue → cyan → green →
    //                    yellow → red).
    const paintResult = xeokit.presentations.heatmaps.applyHeatMapMaterials({
        sceneModel,
        roughness: 0.6
    });
    if (!paintResult.ok) throw new Error(paintResult.error);


    // ── View, lighting, HDR IBL.
    const view = studio.viewManager.createView({
        camera: {
            eye:  [31.38663988418555, 32.115413398051004, 14.796097980600416],
            look: [0.6121272273206806, 6.666971960818746, 2.5235511335317735],
            up:   [-0.2263867800274616, -0.18720656464184895, 0.9558779880213767]
        },
        renderMode: xeokit.base.constants.RealisticRender,
        effects: {
            tonemap: { sRGBEncode: true }
        }
    });

    studio.openInfoPanelFromMeta();
    studio.finished();

    // ── Interactive brush.
    //
    // Click and drag to paint white onto the heat-map of whichever
    // SceneMesh the cursor hits. SceneRaycaster turns the canvas pointer
    // into a world-space ray + hit, paintHeatMapPoint inverts the
    // mesh's worldMatrix to drop the hit into local space, projects
    // onto the same UV axes paintHeatMap chose, and splats a circular
    // brush of texels into the existing ImageData — then reassigns
    // through `texture.imageData = ...` to fire the change event.
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
            color: [1, 1, 1],
            radius: 16,
            opacity: 1.0,
            falloff: 1.5
        });
        if (!paint.ok) {
            console.warn("[paintHeatMapPoint]", paint.error);
        }
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
    console.error("[PaintSceneModelHeatMaps_Duplex]", err);
});
