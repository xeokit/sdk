// ─────────────────────────────────────────────────────────────────
// Demo: loading the FloorPlan DWG via DWGLoader.
//
// The whole DWG pipeline — libredwg-web CDN load, byte parsing,
// DwgDatabase → DWGDocument mapping, SceneModel emission — lives
// inside the SDK now. Callers just do:
//
//     await new DWGLoader().load({fileData, sceneModel});
//
// libredwg-web (GPL-3.0) is fetched from a CDN on first use; URLs
// are configured on the constructor via `DWGLoaderParams.libredwgEsmUrl` /
// `libredwgWasmDir` for self-hosting / CSP / version pinning.
// Pre-initialised parser instances can be injected on the
// constructor via `DWGLoaderParams.libredwg` for Node hosts where
// CDN dynamic imports don't work.
// ─────────────────────────────────────────────────────────────────

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {DWGLoader} = xeokit.formats.dwg;

const MODEL_URL = "../../models/ArchDrawing/dwg/model.dwg";


const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

    const infoEl = document.getElementById("info");

    // Placeholder camera — refit on the loaded scene's AABB once
    // we know it.
    const view = studio.viewManager.createView({
        id: "demoView",
        camera: {
            projection: "perspective",
            eye:  [0, 0, 1000],
            look: [0, 0, 0],
            up:   [0, 1, 0],
        },
    });

    // Optional sidecar — apply the model's Y-up → Z-up coordinate
    // system if present.
    let coordinateSystem;
    try {
        coordinateSystem = await fetch("../../models/FloorPlan/coordSys.json")
            .then(r => r.ok ? r.json() : undefined);
    } catch { /* sidecar optional */ }

    const sceneModelRes = studio.scene.createModel({
        id: "FloorPlanDWG",
        ...(coordinateSystem ? {coordinateSystem} : {}),
    });
    if (!sceneModelRes.ok) {
        infoEl.innerHTML = `<span class="fail">createModel failed: ${sceneModelRes.error}</span>`;
        throw new Error(sceneModelRes.error);
    }

    // Fetch the DWG bytes.
    let dwgBytes;
    try {
        infoEl.innerHTML = `Fetching <code>${MODEL_URL}</code> …`;
        dwgBytes = await fetch(MODEL_URL).then(r => {
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            return r.arrayBuffer();
        });
    } catch (e) {
        infoEl.innerHTML =
            `<span class="fail">Failed to fetch <code>${MODEL_URL}</code>: ${e?.message ?? e}</span><br>` +
            `<span class="muted">Drop a DWG file at that path to run the example.</span>`;
        throw e;
    }

    infoEl.innerHTML = `Parsing ${(dwgBytes.byteLength / 1024).toFixed(0)} KB of DWG (libredwg from CDN) …`;
    const result = await new DWGLoader().load(
        {fileData: dwgBytes, sceneModel: sceneModelRes.value},
        {
            scale: 1,
            circleSteps: 64,
            lineWidthScale: 4.0,
            minLineWidth: 1.0,
            renderText: true,
            objectIdStrategy: "layer",
        },
    );

    if (!result.ok) {
        infoEl.innerHTML = `<span class="fail">DWGLoader failed: ${result.error}</span>`;
        throw new Error(result.error);
    }

    const r = result.value;

    // Fit camera to scene AABB.
    try {
        const aabb = studio.picking.collisionIndex.getSceneAABB();
        if (aabb) studio.viewManager.fitToAabb(view, aabb);
    } catch (e) {
        console.warn("[formats_dwg_floorPlan] camera fit skipped:", e);
    }

    const count = (v) => (typeof v === "number" ? v : 0).toLocaleString();
    const warnRow = r.parserWarnings
        ? `<span class="muted">libredwg warnings: code ${r.parserWarnings} (recoverable)</span><br>`
        : "";
    infoEl.innerHTML =
        `<b>FloorPlan DWG loaded</b><br>` +
        `${count(r.segmentCount)} line segments<br>` +
        `${count(r.triangleCount)} fill triangles<br>` +
        `${count(r.textCount)} text labels<br>` +
        `${count(r.insertCount)} INSERT block expansions<br>` +
        `${r.sceneObjectIds.length} SceneObjects (one per DWG layer)<br>` +
        warnRow +
        `<span class="muted">parsed by @mlightcad/libredwg-web (GPL-3.0)</span>`;

    studio.finished();
});
