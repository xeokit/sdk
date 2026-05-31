// Demo: importing a vector PDF as a SceneModel — strokes + fills.
//
// Exercises every v2 PDFLoader path:
//  - per-stroke colour + line width buckets (multi-coloured walls,
//    thick object lines vs thin dimensions)
//  - filled regions (room poché, hatch infill, filled symbols)
//  - cubic-bezier tessellation (door swing arc, circular column)
//
// pdf.js is loaded as ESM from a CDN — the SDK does NOT bundle it.
//
// The PDF itself is generated in-memory at the bottom of this file
// so the example is self-contained (no binary asset shipped). A
// production deployment would just point `studio.loadModel` at a
// real PDF on disk.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {PDFLoader} = xeokit.formats.pdf;


const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

    // Frame the 800×600-point page from above. Identity-basis scene
    // means Y is world-up; PDF y-up aligns with that natively.
    studio.viewManager.createView({
        id: "demoView",
        camera: {
            projection: "perspective",
            // Centre the camera slightly above the page midpoint to
            // include the title-block strip drawn above the
            // building envelope. Pulled back to ~1100 so the
            // 800×600-point page plus the property line + title
            // text all fit in the default FOV.
            eye:  [400, 320, 1100],
            look: [400, 320, 0],
            up:   [0, 1, 0],
        },
    });

    const sceneModelRes = studio.scene.createModel({id: "vectorPlan"});
    if (sceneModelRes.ok === false) {
        throw new Error(`createModel failed: ${sceneModelRes.error}`);
    }
    const sceneModel = sceneModelRes.value;

    const fileData = buildVectorPlanPdf();

    const loader = new PDFLoader();
    const result = await loader.load(
        {fileData, sceneModel},
        {
            scale: 1,
            // No `color` / `fillColor` override — let the PDF's own
            // discipline-coded ink + room-fill palette flow through.
            bezierSteps: 20,           // crisp door swing
            lineWidthScale: 1.4,
            minLineWidth: 1.0,
            renderFills: true,
            renderImages: true,
        },
    );

    if (result.ok === false) {
        throw new Error(`PDF import failed: ${result.error}`);
    }

    const page = result.value.pages[0];
    console.log(
        `[demo] page 1: ${page.segmentCount} segments, ` +
        `${page.triangleCount} fill triangles, ` +
        `${page.imageCount} images, ` +
        `${page.textCount} text labels`,
    );

    studio.finished();
});


// ─────────────────────────────────────────────────────────────────
// Vector PDF authoring helper.
// ─────────────────────────────────────────────────────────────────
//
// Builds a valid single-page PDF 1.4 byte stream of a small floor
// plan with:
//
//   - Filled rooms (poché — sand for the office, pale blue for the
//     lobby, light green for the planted court)
//   - Outer building envelope in heavy black ink
//   - Internal partitions in mid-weight black
//   - Door swing arc + door leaf in red (services discipline)
//   - Round column in navy with a black hatched fill
//   - Dimension line in cyan, thin
//
// Multiple stroke colours + widths + fill colours exercise the new
// per-style bucketing in the loader.

function buildVectorPlanPdf() {
    const PAGE_W = 800;
    const PAGE_H = 600;

    const content = buildContentStream(PAGE_W, PAGE_H);

    // /Helvetica is one of the 14 PDF standard fonts — every PDF reader
    // (pdf.js included) has metrics for it built in, so we don't need
    // to embed font tables.
    const objects = [
        `<< /Type /Catalog /Pages 2 0 R >>`,
        `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
        `<< /Type /Page /Parent 2 0 R ` +
            `/MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
            `/Contents 4 0 R ` +
            `/Resources << /Font << /F1 5 0 R >> >> >>`,
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
    ];

    const chunks = [];
    const offsets = [];
    let cursor = 0;
    const push = (s) => { chunks.push(s); cursor += s.length; };

    push(`%PDF-1.4\n`);
    push(`%\xE2\xE3\xCF\xD3\n`);
    for (let i = 0; i < objects.length; i++) {
        offsets.push(cursor);
        push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
    }
    const xrefOffset = cursor;
    let xref = `xref\n0 ${objects.length + 1}\n`;
    xref += `0000000000 65535 f \n`;
    for (const o of offsets) {
        xref += `${pad10(o)} 00000 n \n`;
    }
    push(xref);
    push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`);
    push(`startxref\n${xrefOffset}\n%%EOF\n`);

    const joined = chunks.join("");
    const out = new Uint8Array(joined.length);
    for (let i = 0; i < joined.length; i++) out[i] = joined.charCodeAt(i) & 0xff;
    return out;
}


function buildContentStream(W, H) {
    const m = 60;
    const x0 = m, y0 = m;
    const x1 = W - m, y1 = H - m;

    // Internal partitions.
    const partX = x0 + (x1 - x0) * 0.55;
    const partY = y0 + (y1 - y0) * 0.45;

    // Door opening — gap on the vertical partition.
    const doorBot = y0 + (y1 - y0) * 0.20;
    const doorTop = doorBot + 70;

    const ops = [];

    // Helper formatters. PDF "rg" sets non-stroking (fill) colour;
    // "RG" sets stroking colour. "w" sets line width. Coordinates
    // and lengths are in user-space points.
    const rg  = (r, g, b) => `${r} ${g} ${b} rg`;
    const RG  = (r, g, b) => `${r} ${g} ${b} RG`;
    const w   = (px) => `${px} w`;

    // ── 1. Filled rooms (drawn first so strokes overlay them) ──

    // Lobby — pale blue, north-west quadrant.
    ops.push(rg(0.85, 0.90, 0.98));
    ops.push(`${x0} ${partY} m`);
    ops.push(`${partX} ${partY} l`);
    ops.push(`${partX} ${y1} l`);
    ops.push(`${x0} ${y1} l`);
    ops.push(`h f`);                       // close + fill

    // Office — sand poché, south-west quadrant.
    ops.push(rg(0.94, 0.90, 0.78));
    ops.push(`${x0} ${y0} m`);
    ops.push(`${partX} ${y0} l`);
    ops.push(`${partX} ${partY} l`);
    ops.push(`${x0} ${partY} l`);
    ops.push(`h f`);

    // Planted court — light green, north-east quadrant.
    ops.push(rg(0.86, 0.94, 0.83));
    ops.push(`${partX} ${partY} m`);
    ops.push(`${x1} ${partY} l`);
    ops.push(`${x1} ${y1} l`);
    ops.push(`${partX} ${y1} l`);
    ops.push(`h f`);

    // ── 2. Walls — heavy black ink, 2.4 px ──

    ops.push(RG(0, 0, 0));
    ops.push(w(2.4));

    // Outer envelope.
    ops.push(`${x0} ${y0} m`);
    ops.push(`${x1} ${y0} l`);
    ops.push(`${x1} ${y1} l`);
    ops.push(`${x0} ${y1} l`);
    ops.push(`h S`);

    // Horizontal partition (east half).
    ops.push(`${partX} ${partY} m`);
    ops.push(`${x1} ${partY} l`);
    ops.push(`S`);

    // ── 3. Mid-weight internal partitions, 1.6 px ──

    ops.push(w(1.6));
    // Vertical partition, broken by the door opening.
    ops.push(`${partX} ${y0} m ${partX} ${doorBot} l S`);
    ops.push(`${partX} ${doorTop} m ${partX} ${y1} l S`);

    // ── 4. Door — red services ink ──

    ops.push(RG(0.85, 0.20, 0.18));
    ops.push(w(1.3));

    // Door leaf (closed position) — vertical line.
    ops.push(`${partX} ${doorBot} m ${partX + (doorTop - doorBot)} ${doorBot} l S`);

    // Door swing arc — quarter-circle cubic-bezier approximation.
    const r = doorTop - doorBot;
    const k = 0.5522847498 * r;
    ops.push(w(0.6));
    ops.push(`${partX + r} ${doorBot} m`);
    ops.push(
        `${partX + r}     ${doorBot + k} ` +
        `${partX + k}     ${doorBot + r} ` +
        `${partX}         ${doorBot + r} c S`,
    );

    // ── 5. Column — navy stroke + dark fill ──

    const cx = x0 + (partX - x0) * 0.5;
    const cy = y0 + (y1 - y0) * 0.5;
    const rad = 22;
    const ck = 0.5522847498 * rad;
    // Fill first.
    ops.push(rg(0.20, 0.20, 0.24));
    ops.push(`${cx + rad} ${cy} m`);
    ops.push(`${cx + rad} ${cy + ck} ${cx + ck} ${cy + rad} ${cx} ${cy + rad} c`);
    ops.push(`${cx - ck} ${cy + rad} ${cx - rad} ${cy + ck} ${cx - rad} ${cy} c`);
    ops.push(`${cx - rad} ${cy - ck} ${cx - ck} ${cy - rad} ${cx} ${cy - rad} c`);
    ops.push(`${cx + ck} ${cy - rad} ${cx + rad} ${cy - ck} ${cx + rad} ${cy} c`);
    ops.push(`h f`);
    // Then a navy outline.
    ops.push(RG(0.06, 0.18, 0.45));
    ops.push(w(1.0));
    ops.push(`${cx + rad} ${cy} m`);
    ops.push(`${cx + rad} ${cy + ck} ${cx + ck} ${cy + rad} ${cx} ${cy + rad} c`);
    ops.push(`${cx - ck} ${cy + rad} ${cx - rad} ${cy + ck} ${cx - rad} ${cy} c`);
    ops.push(`${cx - rad} ${cy - ck} ${cx - ck} ${cy - rad} ${cx} ${cy - rad} c`);
    ops.push(`${cx + ck} ${cy - rad} ${cx + rad} ${cy - ck} ${cx + rad} ${cy} c`);
    ops.push(`h S`);

    // ── 6. Diagonal hatching across the SE room ──

    ops.push(RG(0.55, 0.55, 0.55));
    ops.push(w(0.4));
    const hX0 = partX + 8, hX1 = x1 - 8;
    const hY0 = y0 + 8,    hY1 = partY - 8;
    const hatchLen = hY1 - hY0;
    for (let xh = hX0; xh < hX1 - hatchLen; xh += 14) {
        ops.push(`${xh} ${hY0} m ${xh + hatchLen} ${hY1} l S`);
    }

    // ── 7. Dimension line — thin cyan, ticks at each end ──

    ops.push(RG(0.10, 0.45, 0.60));
    ops.push(w(0.6));
    const dimY = y0 - 28;
    ops.push(`${x0} ${dimY} m ${x1} ${dimY} l S`);
    ops.push(`${x0} ${dimY - 6} m ${x0} ${dimY + 6} l S`);
    ops.push(`${x1} ${dimY - 6} m ${x1} ${dimY + 6} l S`);

    // ── 8. Hidden / centreline / property dashes ──
    // PDF `d` op: `[dashArray] phase d`. dashArray entries are in
    // user-space points; an empty `[]` means solid. Exercises the
    // new dash-bucketing path — each unique (colour, width, dash)
    // combination gets its own SceneMaterial in the loader.

    // Hidden setback line — dashed grey, runs above the south wall.
    ops.push(RG(0.4, 0.4, 0.4));
    ops.push(w(0.8));
    ops.push(`[4 3] 0 d`);                 // 4pt dash, 3pt gap
    const setbackY = y0 + 28;
    ops.push(`${x0 + 30} ${setbackY} m ${x1 - 30} ${setbackY} l S`);

    // Centreline through the column — dash-dot, navy.
    ops.push(RG(0.06, 0.18, 0.45));
    ops.push(w(0.7));
    ops.push(`[8 2 1 2] 0 d`);             // long-dash, gap, dot, gap
    ops.push(`${cx - 40} ${cy} m ${cx + 40} ${cy} l S`);
    ops.push(`${cx} ${cy - 40} m ${cx} ${cy + 40} l S`);

    // Property line — long dashes, dark red, around the perimeter.
    ops.push(RG(0.55, 0.18, 0.18));
    ops.push(w(0.9));
    ops.push(`[12 3] 0 d`);
    const pad = 14;
    ops.push(`${x0 - pad} ${y0 - pad} m`);
    ops.push(`${x1 + pad} ${y0 - pad} l`);
    ops.push(`${x1 + pad} ${y1 + pad} l`);
    ops.push(`${x0 - pad} ${y1 + pad} l`);
    ops.push(`h S`);

    // Restore solid pattern for any future content.
    ops.push(`[] 0 d`);

    // ── 9. Text labels ──
    // PDF text blocks use BT…ET with `Tf` (font + size), `Td`
    // (position) and `Tj` (show string). Coordinates are in PDF
    // user-space points; pdf.js's getTextContent returns transforms
    // composed with the text matrix so the loader sees baseline-left
    // (x, y) positions directly.
    //
    // Strings are written as ASCII; non-ASCII would need escapes or
    // a CIDFont. Helvetica WinAnsi is enough for the labels here.
    const lblBlack = `0 0 0 rg`;
    const text = (font, sizePt, x, y, str) => [
        `BT`,
        `${font} ${sizePt} Tf`,
        `1 0 0 1 ${x} ${y} Tm`,           // text matrix at (x, y)
        `(${escapePdfString(str)}) Tj`,
        `ET`,
    ].join("\n");

    ops.push(lblBlack);

    // Room labels — centred-ish on each filled room.
    ops.push(text("/F1", 14,
        x0 + (partX - x0) * 0.5 - 30, y0 + (partY - y0) * 0.5,
        "Office",
    ));
    ops.push(text("/F1", 14,
        x0 + (partX - x0) * 0.5 - 30, partY + (y1 - partY) * 0.5,
        "Lobby",
    ));
    ops.push(text("/F1", 12,
        partX + (x1 - partX) * 0.5 - 40, partY + (y1 - partY) * 0.5,
        "Planted Court",
    ));

    // Dimension label centred on the dimension line.
    ops.push(text("/F1", 10,
        (x0 + x1) * 0.5 - 22, y0 - 44,
        `${(x1 - x0).toFixed(0)} mm`,
    ));

    // Sheet title and number, top-right corner.
    ops.push(text("/F1", 18, x1 - 230, y1 + 18, "A-101  Ground Floor Plan"));
    ops.push(text("/F1", 9,  x1 - 230, y1 + 4,  "Scale 1 : 50  /  May 2026"));

    // Column label — small caps to identify the structural element.
    ops.push(text("/F1", 8, cx - 8, cy - 38, "C-01"));

    return ops.join("\n");
}

/**
 * Escape a string for inclusion in a PDF text-show op. Handles the
 * three characters the PDF lexer treats specially: `(`, `)`, `\`.
 */
function escapePdfString(s) {
    return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}


function pad10(n) {
    const s = String(n);
    return "0".repeat(Math.max(0, 10 - s.length)) + s;
}
