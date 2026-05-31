// ─────────────────────────────────────────────────────────────────
// Demo: importing an AutoCAD DXF drawing via DXFLoader.
//
// DXF is open ASCII so the SDK parses it in-tree — no third-party
// library to wire. Callers just do:
//
//     await new DXFLoader().load({fileData: dxfText, sceneModel});
//
// The synthesised DXF text below covers every entity the built-in
// parser handles, plus a BLOCKS section so INSERT recursion is
// exercised. A production deployment would just
// `fetch("/plans/site.dxf").then(r => r.text())` and pass that to
// `loader.load`.
// ─────────────────────────────────────────────────────────────────

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {DXFLoader} = xeokit.formats.dxf;


const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

    const infoEl = document.getElementById("info");

    studio.viewManager.createView({
        id: "demoView",
        camera: {
            projection: "perspective",
            eye:  [400, 300, 900],
            look: [400, 300, 0],
            up:   [0, 1, 0],
        },
    });

    const sceneModelRes = studio.scene.createModel({id: "dxfPlan"});
    if (!sceneModelRes.ok) {
        infoEl.innerHTML = `<span class="fail">createModel failed: ${sceneModelRes.error}</span>`;
        throw new Error(sceneModelRes.error);
    }

    const dxfText = buildSampleDxfText();

    const result = await new DXFLoader().load(
        {fileData: dxfText, sceneModel: sceneModelRes.value},
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
        infoEl.innerHTML = `<span class="fail">DXF load failed: ${result.error}</span>`;
        throw new Error(result.error);
    }

    const r = result.value;
    infoEl.innerHTML =
        `<b>DXF loaded</b><br>` +
        `${r.segmentCount.toLocaleString()} line segments<br>` +
        `${r.triangleCount.toLocaleString()} fill triangles<br>` +
        `${r.textCount.toLocaleString()} text labels<br>` +
        `${r.insertCount.toLocaleString()} INSERT block expansions<br>` +
        `${r.sceneObjectIds.length} SceneObjects (one per DXF layer)<br>` +
        `<span class="muted">parsed in-tree (no third-party DXF library)</span>`;

    studio.finished();
});


// ─────────────────────────────────────────────────────────────────
// Synthesised DXF source text covering every entity the built-in
// parser + loader handle. Generated programmatically so the
// example stays self-contained (no shipped binary asset).
// ─────────────────────────────────────────────────────────────────
function buildSampleDxfText() {
    // DXF helpers — every record is a pair: code on one line, value on the next.
    const out = [];
    const pair = (c, v) => out.push(String(c), String(v));

    // ── BLOCKS section ────────────────────────────────────────────
    pair(0, "SECTION"); pair(2, "BLOCKS");

    // Block "CHAIR" — a small rectangle + back line.
    pair(0, "BLOCK"); pair(2, "CHAIR");
    pair(10, "0"); pair(20, "0"); pair(30, "0");
    // LWPOLYLINE rectangle (closed) on FURNITURE layer, grey
    pair(0, "LWPOLYLINE"); pair(8, "FURNITURE"); pair(62, "8");
    pair(70, "1");                  // closed flag
    pair(10, "-15"); pair(20, "-15");
    pair(10, "15");  pair(20, "-15");
    pair(10, "15");  pair(20, "15");
    pair(10, "-15"); pair(20, "15");
    // Back line
    pair(0, "LINE"); pair(8, "FURNITURE"); pair(62, "8");
    pair(10, "-12"); pair(20, "12"); pair(30, "0");
    pair(11, "12");  pair(21, "12"); pair(31, "0");
    pair(0, "ENDBLK");

    pair(0, "ENDSEC");

    // ── ENTITIES section ──────────────────────────────────────────
    pair(0, "SECTION"); pair(2, "ENTITIES");

    // Outer wall envelope — 4 LINEs on WALLS (white)
    const wall = (x1, y1, x2, y2) => {
        pair(0, "LINE"); pair(8, "WALLS"); pair(62, "7");
        pair(10, x1); pair(20, y1); pair(30, "0");
        pair(11, x2); pair(21, y2); pair(31, "0");
    };
    wall("40", "40",   "760", "40");
    wall("760", "40",  "760", "560");
    wall("760", "560", "40",  "560");
    wall("40", "560",  "40",  "40");
    // Internal partition split by door
    wall("420", "40",  "420", "240");
    wall("420", "300", "420", "560");

    // LWPOLYLINE room — closed
    pair(0, "LWPOLYLINE"); pair(8, "ROOMS"); pair(62, "2");
    pair(70, "1");          // closed
    pair(10, "60"); pair(20, "60");
    pair(10, "400"); pair(20, "60");
    pair(10, "400"); pair(20, "280");
    pair(10, "60"); pair(20, "280");

    // CIRCLE column on STRUCT (cyan)
    pair(0, "CIRCLE"); pair(8, "STRUCT"); pair(62, "4");
    pair(10, "230"); pair(20, "170"); pair(30, "0");
    pair(40, "22");

    // ARC door swing on DOORS (red)
    pair(0, "ARC"); pair(8, "DOORS"); pair(62, "1");
    pair(10, "420"); pair(20, "240"); pair(30, "0");
    pair(40, "60");
    pair(50, "0");
    pair(51, "90");

    // 3DFACE stair tread on STAIRS
    pair(0, "3DFACE"); pair(8, "STAIRS"); pair(62, "9");
    pair(10, "560"); pair(20, "80");  pair(30, "0");
    pair(11, "720"); pair(21, "80");  pair(31, "0");
    pair(12, "720"); pair(22, "130"); pair(32, "0");
    pair(13, "560"); pair(23, "130"); pair(33, "0");

    // INSERT CHAIR × 3 with varied rotation
    const insertChair = (x, y, rot) => {
        pair(0, "INSERT"); pair(8, "FURNITURE"); pair(2, "CHAIR");
        pair(10, x); pair(20, y); pair(30, "0");
        pair(50, rot);
    };
    insertChair("120", "130", "0");
    insertChair("120", "220", "45");
    insertChair("320", "220", "-30");

    // TEXT room labels
    const text = (str, x, y, h, layer = "LABELS", color = "7") => {
        pair(0, "TEXT"); pair(8, layer); pair(62, color);
        pair(1, str);
        pair(10, x); pair(20, y); pair(30, "0");
        pair(40, h);
    };
    text("OFFICE",   "170", "160", "22");
    text("LOBBY",    "180", "420", "22");
    text("STORAGE",  "490", "290", "18");
    text("A-101  GROUND FLOOR PLAN", "60", "580", "16", "TITLE", "7");

    pair(0, "ENDSEC");
    pair(0, "EOF");

    return out.join("\n");
}
