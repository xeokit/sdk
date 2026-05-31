// Demo: importing a PDF drawing via the injectable pdf.js adapter.
//
// The xeokit SDK does NOT bundle pdf.js. This example imports it as
// ESM directly from a CDN — pdfjs-dist 4.x is ESM-only, so there's
// no `pdfjsLib` window global to lean on. The imported namespace is
// shape-compatible with the SDK's PDFAdapter interface and gets
// passed straight to the PDFLoader constructor.
//
// The PDF itself is the standard demo asset shipped beside the other
// models — `models/FloorPlan/pdf/model.pdf`. We fetch it (plus its
// optional `coordSys.json` sidecar) directly and feed both into a
// SceneModel + PDFLoader pair — no registry, no studio.loadModel
// route.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {PDFLoader}        = xeokit.formats.pdf;
const {buildDrawingPanel} = xeokit.presentations.drawings;

// PDF.js worker URL — same CDN + version as the main library.
// Mismatched main / worker versions are pdf.js's #1 runtime failure
// mode; pinning both to the same URL stem avoids it. In production
// host both files yourself.

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

    // The shipped PDF is 600×780 PDF points (US Letter-ish). Loading
    // with `scale: 1` lands the drawing in scene-unit space at those
    // raw dimensions, so the camera frames the page bounds directly.
    // For a real architectural drawing at a known paper scale you'd
    // pass `scale: paperToWorld` here (e.g. `25.4 / 72` for points →
    // millimetres, or `(25.4 / 72) * 50` for a 1:50 plan in mm).
    studio.viewManager.createView({
        id: "demoView",
        camera: {
            projection: "perspective",
            // Centre of the 600×780 drawing, pulled back along +Z so
            // the whole page sits in view.
            "eye": [
                1488.2089818662985,
                1024.6204887629212,
                1888.3051542186686
            ],
            "look": [
                1488.2089818662985,
                1024.6204887629212,
                -4.141826882800615
            ],
            "up": [
                0,
                1,
                0
            ],
        },
    });

    // Optional sidecar: load model/FloorPlan/coordSys.json if present
    // and apply it to the SceneModel so the PDF lands in the right
    // axis convention (the floorplan ships a Y-up frame).
    let coordinateSystem;
    try {
        coordinateSystem = await fetch("../../models/FloorPlan/coordSys.json")
            .then(r => r.ok ? r.json() : undefined);
    } catch { /* sidecar optional — proceed without */ }

    const sceneModelRes = studio.scene.createModel({
        id: "FloorPlan",
        ...(coordinateSystem ? {coordinateSystem} : {}),
    });
    if (sceneModelRes.ok === false) {
        throw new Error(`createModel failed: ${sceneModelRes.error}`);
    }
    const sceneModel = sceneModelRes.value;

    const fileData = await fetch("../../models/FloorPlan/pdf/model.pdf")
        .then(r => r.arrayBuffer());

    const loader = new PDFLoader();
    const result = await loader.load(
        {fileData, sceneModel},
        {
            scale: 1,
            // No `color` override — PDF's own per-stroke colours flow
            // through; segments get bucketed by (colour, width) so
            // discipline-coded ink + line-weight hierarchy (object
            // lines vs. dimensions vs. hatches) survive.
            bezierSteps: 16,             // smoother curved walls / fittings
            lineWidthScale: 1.5,         // sub-pixel hairlines → ~1 px
        },
    );

    if (result.ok === false) {
        throw new Error(`PDF import failed: ${result.error}`);
    }

    // Translucent backing panel behind the PDF page —
    // `drawings.buildDrawingPanel` is the same chrome that
    // `buildDrawing` uses internally, exposed as a standalone
    // utility so 2D-drawing examples can drop it in without
    // running the full projection pipeline.

    // ── SceneModel AABB ──────────────────────────────────────────
    // Studio's picking pipeline maintains a BVH over the scene; ask
    // it for the combined AABB of every object the PDFLoader just
    // emitted. That's the canonical "AABB of the SceneModel" — no
    // per-mesh walk, and stays correct if more objects are added
    // later.
    const sceneAabb = studio.picking.collisionIndex.getCombinedObjectAABB(
        Object.keys(sceneModel.objects),
    );
    if (!sceneAabb) {
        throw new Error("SceneModel AABB unavailable (no indexed objects)");
    }

    // ── Project the panel behind the page ────────────────────────
    // The basis matches the camera-look axis (forward = -Z) so the
    // panel sits perpendicular to the page plane. The panel's own
    // AABB is the SceneModel's XY extents stretched into a thin Z
    // slab BEHIND the loaded geometry — its front face PANEL_GAP
    // units behind `sceneAabb.zMin`. With `planeDepth = -slab.zMax`,
    // buildDrawingPanel's dInner clamp lands the visible backdrop
    // wall exactly on the slab's front face. `margin: 40` adds a
    // 40-unit border around the page on every side.
    const PANEL_GAP = 0.5;
    const panelAabb = [
        sceneAabb[0], sceneAabb[1], sceneAabb[2] - 1.0 - PANEL_GAP,
        sceneAabb[3], sceneAabb[4], sceneAabb[2]       - PANEL_GAP,
    ];
    const panelRes = buildDrawingPanel({
        targetModel: sceneModel,
        basis:       {right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, -1]},
        aabb:        panelAabb,
        planeDepth:  -panelAabb[5],
        margin:      40,
        spec: {
            color:   [0.96, 0.97, 0.99],
            opacity: 0.85,
        },
    });
    if (panelRes.ok === false) {
        throw new Error(`buildDrawingPanel failed: ${panelRes.error}`);
    }

    studio.finished();
});
