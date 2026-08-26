// PDF authoring for the Duplex Level 1 plan, shared between
// examples/import/pdf/duplex-level1 (standalone) and
// examples/import/pdf/duplex-level1 (overlaid on the Duplex IFC).
//
// Exports buildLevelOnePlanPdf() — a zero-dependency function that
// returns the PDF byte stream as Uint8Array. All coordinates are in
// PDF user-space millimetres; load via the SDK with scale: 0.001 to
// land the plan in scene-metres alongside the Duplex IFC.

// ═══════════════════════════════════════════════════════════════════
// Vector PDF authoring.
// ═══════════════════════════════════════════════════════════════════
//
// Every coordinate is in PDF user-space millimetres. The MediaBox is
// large enough to contain the building plus grid bubbles, dimension
// chains, north arrow, and title block.

const PAGE = {
    // MediaBox: [llx, lly, urx, ury]. We let it extend into negative
    // coords so the building footprint can sit at (0, 0) and dimensions
    // + bubbles + property line can extend outside without clipping.
    llx: -3000, lly: -3000,
    urx: 16000, ury: 17500,

    // Building exterior envelope (outer face of exterior walls).
    bx0: 0, by0: 0,
    bx1: 10500, by1: 14000,

    extWallT: 250,    // exterior wall thickness (mm)
    intWallT: 100,    // interior partition thickness
    partyT:   200,    // party wall between units
    partyX:   5250,   // party wall centreline x
};

// Discipline-coded ink palette.
const INK = {
    poche:     [0.13, 0.13, 0.13],
    wallLine:  [0.06, 0.06, 0.06],
    intWall:   [0.18, 0.18, 0.18],
    door:      [0.70, 0.20, 0.18],
    window:    [0.13, 0.45, 0.62],
    fixture:   [0.30, 0.30, 0.30],
    stair:     [0.20, 0.20, 0.20],
    stairArrow:[0.05, 0.05, 0.05],
    dim:       [0.10, 0.45, 0.60],
    grid:      [0.50, 0.50, 0.55],
    gridBub:   [0.05, 0.05, 0.05],
    centre:    [0.08, 0.20, 0.50],
    property:  [0.55, 0.18, 0.18],
    titleLine: [0.05, 0.05, 0.05],
    titleText: [0.05, 0.05, 0.05],
    north:     [0.05, 0.05, 0.05],
    hatch:     [0.55, 0.55, 0.55],
};

// Room poché fills.
const ROOM_FILL = {
    living:   [0.93, 0.91, 0.83],   // warm sand
    dining:   [0.88, 0.92, 0.86],   // soft green
    kitchen:  [0.85, 0.90, 0.94],   // pale blue
    bath:     [0.86, 0.91, 0.96],   // bath blue (slightly cooler)
    bedroom:  [0.92, 0.86, 0.90],   // pale rose
    foyer:    [0.95, 0.94, 0.91],
    stair:    [0.91, 0.91, 0.93],
    hall:     [0.94, 0.94, 0.94],
    closet:   [0.90, 0.90, 0.90],
    powder:   [0.88, 0.93, 0.96],
    utility:  [0.94, 0.92, 0.86],
};


/**
 * @param {object} [opts]
 * @param {boolean} [opts.matchDuplexIfc] When true, prepend a CTM
 *   scale to the content stream so the rendered footprint matches
 *   the classic Duplex Apartment IFC's actual walls bbox (8.8 m × 17.8 m,
 *   measured from the IfcWallStandardCase AABBs in
 *   models/Duplex/scenemodel/model.json). Without this the plan
 *   renders at its authored 10.5 × 14 m. Scale is anisotropic
 *   (X ≈ 0.84, Y ≈ 1.27) — circles become slight ellipses and text
 *   becomes slightly tall/narrow, but the building footprint
 *   coincides with the IFC for direct overlay.
 */
export function buildLevelOnePlanPdf(opts = {}) {
    const sx = opts.matchDuplexIfc ? 8800 / 10500 : 1;     // ≈ 0.838
    const sy = opts.matchDuplexIfc ? 17800 / 14000 : 1;    // ≈ 1.271
    const ctmPrelude = opts.matchDuplexIfc
        ? `${sx.toFixed(6)} 0 0 ${sy.toFixed(6)} 0 0 cm\n`
        : "";
    const content = ctmPrelude + buildContentStream();

    // MediaBox must contain the scaled content. Authored extents max
    // at (urx=16000, ury=17500); after sy=1.27 the Y extent reaches
    // ~22 000, so pad accordingly when matching the Duplex.
    const urx = opts.matchDuplexIfc ? Math.ceil(PAGE.urx * sx) : PAGE.urx;
    const ury = opts.matchDuplexIfc ? Math.ceil(PAGE.ury * sy) : PAGE.ury;
    const llx = opts.matchDuplexIfc ? Math.floor(PAGE.llx * sx) : PAGE.llx;
    const lly = opts.matchDuplexIfc ? Math.floor(PAGE.lly * sy) : PAGE.lly;

    const objects = [
        `<< /Type /Catalog /Pages 2 0 R >>`,
        `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
        `<< /Type /Page /Parent 2 0 R ` +
            `/MediaBox [${llx} ${lly} ${urx} ${ury}] ` +
            `/Contents 4 0 R ` +
            `/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
        `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
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
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) xref += `${pad10(o)} 00000 n \n`;
    push(xref);
    push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`);
    push(`startxref\n${xrefOffset}\n%%EOF\n`);

    const joined = chunks.join("");
    const out = new Uint8Array(joined.length);
    for (let i = 0; i < joined.length; i++) out[i] = joined.charCodeAt(i) & 0xff;
    return out;
}


// ─────────────────────────────────────────────────────────────────
// Plan composition.
// ─────────────────────────────────────────────────────────────────

function buildContentStream() {
    const o = [];     // op list — every helper pushes to this

    // ── 1. Property line (dashed, around the lot) ──
    propertyLine(o);

    // ── 2. Room fills — drawn first, so wall lines + fixtures overlay ──
    roomFills(o);

    // ── 3. Wall poché — dark fill between exterior + party-wall faces ──
    wallPoche(o);

    // ── 4. Interior partition fills ──
    interiorPartitions(o);

    // ── 5. Wall outlines ──
    wallOutlines(o);

    // ── 6. Windows on exterior walls ──
    windowMarks(o);

    // ── 7. Doors — leaf + swing arcs ──
    doors(o);

    // ── 8. Fixtures + stairs ──
    fixtures(o);

    // ── 9. Grid (dashed lines + bubbles) ──
    grid(o);

    // ── 10. Dimensions ──
    dimensions(o);

    // ── 11. North arrow + title block ──
    northArrow(o);
    titleBlock(o);

    // ── 12. Text labels (last so they sit on top of fills) ──
    roomLabels(o);

    return o.join("\n");
}


// ─────────────────────────────────────────────────────────────────
// PDF op helpers.
// ─────────────────────────────────────────────────────────────────

const f = (v) => Number.isInteger(v) ? String(v) : v.toFixed(3);
const rgOp = (c) => `${f(c[0])} ${f(c[1])} ${f(c[2])} rg`;
const RGOp = (c) => `${f(c[0])} ${f(c[1])} ${f(c[2])} RG`;
const wOp  = (px) => `${f(px)} w`;
const dOp  = (arr, phase = 0) =>
    arr.length === 0 ? `[] 0 d` : `[${arr.map(f).join(" ")}] ${f(phase)} d`;

function moveTo(o, x, y) { o.push(`${f(x)} ${f(y)} m`); }
function lineTo(o, x, y) { o.push(`${f(x)} ${f(y)} l`); }
function curveTo(o, x1, y1, x2, y2, x3, y3) {
    o.push(`${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)} ${f(x3)} ${f(y3)} c`);
}

function rect(o, x0, y0, x1, y1) {
    moveTo(o, x0, y0); lineTo(o, x1, y0); lineTo(o, x1, y1); lineTo(o, x0, y1);
    o.push(`h`);
}
function fillRect(o, x0, y0, x1, y1) { rect(o, x0, y0, x1, y1); o.push(`f`); }
function strokeRect(o, x0, y0, x1, y1) { rect(o, x0, y0, x1, y1); o.push(`S`); }

// 4-bezier-segment circle approximation. k = 0.5522847498 * radius.
function circlePath(o, cx, cy, r) {
    const k = 0.5522847498 * r;
    moveTo(o, cx + r, cy);
    curveTo(o, cx + r, cy + k, cx + k, cy + r, cx,     cy + r);
    curveTo(o, cx - k, cy + r, cx - r, cy + k, cx - r, cy);
    curveTo(o, cx - r, cy - k, cx - k, cy - r, cx,     cy - r);
    curveTo(o, cx + k, cy - r, cx + r, cy - k, cx + r, cy);
    o.push(`h`);
}


// ─────────────────────────────────────────────────────────────────
// Plan layout — interior face coordinates.
// ─────────────────────────────────────────────────────────────────
//
// Building interior bounds (one unit, the LEFT half "Unit A"):
//   x ∈ [250, 5150]   (exterior wall ends at 250; party wall starts at 5150)
//   y ∈ [250, 13750]  (exterior walls)
// Mirror across x = 5250 for Unit B.

const UA = {
    x0: PAGE.extWallT,            // 250
    y0: PAGE.extWallT,            // 250
    x1: PAGE.partyX - PAGE.partyT * 0.5,   // 5150
    y1: PAGE.by1 - PAGE.extWallT,          // 13750
};

// Interior partition centrelines — Unit A.
const PART_A = {
    // Horizontal walls (y values, full width unless trimmed)
    h1: 2900,   // foyer / stair / closet  ←→  living / dining
    h2: 7500,   // living  ←→  kitchen, hall
    h3: 10000,  // kitchen, hall  ←→  family room
    h4: 8500,   // hall  ←→  bath / utility
    // Vertical walls (x values, segment-bounded)
    v1: 2200,   // foyer ↔ stair
    v2: 4000,   // stair ↔ closet/powder
    v3: 3000,   // living ↔ dining (between h1 and h2)
    v4: 2200,   // bath ↔ utility (between h4 and h3)
    v5: 3000,   // hall  ↔ utility (between h2 and h4)
};

// Door positions: [x, y, w, swingDir] — swingDir is one of
//   "NE", "NW", "SE", "SW" giving the corner the hinge sits on.
const DOORS_A = [
    {x: 1200, y: 250,  w: 900,  hingedAt: "SW", swingTo: "N"},  // main entry (south wall)
    {x: 1500, y: 2900, w: 800,  hingedAt: "SW", swingTo: "N"},  // foyer → living  (h1)
    {x: 4400, y: 1900, w: 600,  hingedAt: "SW", swingTo: "N"},  // closet → powder (horiz sub-divider y=1900)
    {x: 2500, y: 7500, w: 900,  hingedAt: "SW", swingTo: "N"},  // hall → living  (h2)
    {x: 1300, y: 8500, w: 700,  hingedAt: "SE", swingTo: "N"},  // hall → bath    (h4)
    {x: 2700, y: 8500, w: 700,  hingedAt: "SW", swingTo: "N"},  // hall → utility (h4)
    {x: 4200, y: 10000,w: 900,  hingedAt: "SW", swingTo: "N"},  // family room    (h3)
];

// Window positions on exterior walls. Each window is a short segment
// of triple parallel strokes. Spec: {wall: "S"|"N"|"E"|"W", from, to}
// where from/to are positions along the wall.
const WINDOWS_A = [
    {wall: "S", from: 2400, to: 3400},   // south, foyer/living
    {wall: "S", from: 3700, to: 4900},   // south, dining
    {wall: "W", from: 3000, to: 4500},   // west, living
    {wall: "W", from: 5500, to: 7000},   // west, kitchen
    {wall: "W", from: 10500,to: 13500},  // west, family
    {wall: "N", from: 1500, to: 3000},   // north, family
    {wall: "N", from: 3500, to: 4800},   // north, family
];


// ─────────────────────────────────────────────────────────────────
// 1. Property line
// ─────────────────────────────────────────────────────────────────

function propertyLine(o) {
    const pad = 1500;
    o.push(RGOp(INK.property));
    o.push(wOp(8));
    o.push(dOp([90, 30, 12, 30]));    // long dash, gap, dot, gap
    o.push(`${f(PAGE.bx0 - pad)} ${f(PAGE.by0 - pad)} m`);
    o.push(`${f(PAGE.bx1 + pad)} ${f(PAGE.by0 - pad)} l`);
    o.push(`${f(PAGE.bx1 + pad)} ${f(PAGE.by1 + pad)} l`);
    o.push(`${f(PAGE.bx0 - pad)} ${f(PAGE.by1 + pad)} l`);
    o.push(`h S`);
    o.push(dOp([]));
}


// ─────────────────────────────────────────────────────────────────
// 2. Room fills (poché)
// ─────────────────────────────────────────────────────────────────

// Returns the rooms for Unit A, mirrored to Unit B as a follow-up.
function roomsA() {
    const x0 = UA.x0, x1 = UA.x1;
    return [
        // South strip
        {name: "Foyer",   fill: ROOM_FILL.foyer,   x0: x0,            y0: UA.y0,     x1: PART_A.v1,        y1: PART_A.h1},
        {name: "Stair",   fill: ROOM_FILL.stair,   x0: PART_A.v1,     y0: UA.y0,     x1: PART_A.v2,        y1: PART_A.h1},
        {name: "Closet",  fill: ROOM_FILL.closet,  x0: PART_A.v2,     y0: UA.y0,     x1: x1,               y1: 1900},
        {name: "Powder",  fill: ROOM_FILL.powder,  x0: PART_A.v2,     y0: 1900,      x1: x1,               y1: PART_A.h1},
        // Middle (living + dining)
        {name: "Living",  fill: ROOM_FILL.living,  x0: x0,            y0: PART_A.h1, x1: PART_A.v3,        y1: PART_A.h2},
        {name: "Dining",  fill: ROOM_FILL.dining,  x0: PART_A.v3,     y0: PART_A.h1, x1: x1,               y1: PART_A.h2},
        // North-middle (hall + kitchen)
        {name: "Hall",    fill: ROOM_FILL.hall,    x0: x0,            y0: PART_A.h2, x1: PART_A.v5,        y1: PART_A.h4},
        {name: "Kitchen", fill: ROOM_FILL.kitchen, x0: PART_A.v5,     y0: PART_A.h2, x1: x1,               y1: PART_A.h3},
        // North (bath, utility, family)
        {name: "Bath",    fill: ROOM_FILL.bath,    x0: x0,            y0: PART_A.h4, x1: PART_A.v4,        y1: PART_A.h3},
        {name: "Utility", fill: ROOM_FILL.utility, x0: PART_A.v4,     y0: PART_A.h4, x1: PART_A.v5,        y1: PART_A.h3},
        {name: "Family",  fill: ROOM_FILL.bedroom, x0: x0,            y0: PART_A.h3, x1: x1,               y1: UA.y1},
    ];
}

function roomsB() {
    // Mirror Unit A across x = PAGE.partyX.
    return roomsA().map(r => ({
        ...r,
        x0: 2 * PAGE.partyX - r.x1,
        x1: 2 * PAGE.partyX - r.x0,
    }));
}

function allRooms() { return [...roomsA(), ...roomsB()]; }

function roomFills(o) {
    for (const r of allRooms()) {
        o.push(rgOp(r.fill));
        fillRect(o, r.x0, r.y0, r.x1, r.y1);
    }
}


// ─────────────────────────────────────────────────────────────────
// 3. Wall poché — solid dark fill between outer face + inner face
// ─────────────────────────────────────────────────────────────────

function wallPoche(o) {
    o.push(rgOp(INK.poche));
    const T = PAGE.extWallT;
    // South wall band
    fillRect(o, PAGE.bx0, PAGE.by0, PAGE.bx1, PAGE.by0 + T);
    // North wall
    fillRect(o, PAGE.bx0, PAGE.by1 - T, PAGE.bx1, PAGE.by1);
    // West wall (full height, between south & north bands)
    fillRect(o, PAGE.bx0, PAGE.by0 + T, PAGE.bx0 + T, PAGE.by1 - T);
    // East wall
    fillRect(o, PAGE.bx1 - T, PAGE.by0 + T, PAGE.bx1, PAGE.by1 - T);
    // Party wall (between units, runs full N-S inside the envelope)
    const px0 = PAGE.partyX - PAGE.partyT * 0.5;
    const px1 = PAGE.partyX + PAGE.partyT * 0.5;
    fillRect(o, px0, PAGE.by0 + T, px1, PAGE.by1 - T);
}


// ─────────────────────────────────────────────────────────────────
// 4. Interior partitions — thin filled rectangles centred on the
//    PART_A centrelines, both units.
// ─────────────────────────────────────────────────────────────────

function interiorPartitions(o) {
    o.push(rgOp(INK.intWall));
    const t = PAGE.intWallT * 0.5;

    // Helper: draw horizontal wall y=Y from x=X0 to X1, both units.
    // Skip door openings.
    const horiz = (Y, X0, X1, gaps = []) => {
        drawWithGaps(o, /*horiz*/true, Y, X0, X1, t, gaps);
        // mirror for unit B
        const mX0 = 2 * PAGE.partyX - X1;
        const mX1 = 2 * PAGE.partyX - X0;
        const mGaps = gaps.map(g => ({
            from: 2 * PAGE.partyX - g.to,
            to:   2 * PAGE.partyX - g.from,
        }));
        drawWithGaps(o, true, Y, mX0, mX1, t, mGaps);
    };
    const vert = (X, Y0, Y1, gaps = []) => {
        drawWithGaps(o, false, X, Y0, Y1, t, gaps);
        const mX = 2 * PAGE.partyX - X;
        drawWithGaps(o, false, mX, Y0, Y1, t, gaps);
    };

    const a = PART_A;
    horiz(a.h1, UA.x0, UA.x1, [{from: 1500, to: 2300}]);  // foyer→living door
    horiz(a.h2, UA.x0, UA.x1, [{from: 2500, to: 3400}]);  // hall→living
    horiz(a.h3, UA.x0, UA.x1, [{from: 4200, to: 5100}]);  // family door
    horiz(a.h4, UA.x0, a.v5, [
        {from: 1300, to: 2000},   // hall→bath
        {from: 2700, to: 3400},   // hall→utility
    ]);
    vert(a.v1, UA.y0, a.h1);
    vert(a.v2, UA.y0, a.h1, [{from: 1900, to: 1900 + 10}]); // hairline
    vert(a.v3, a.h1, a.h2);
    vert(a.v4, a.h4, a.h3);
    vert(a.v5, a.h2, a.h3);

    // Powder room sub-divider (closet ↔ powder), horiz at y=1900 in
    // segment x = v2 .. UA.x1. Door at 4400..5000.
    drawWithGaps(o, true, 1900, a.v2, UA.x1, t, [{from: 4400, to: 5000}]);
    drawWithGaps(o, true, 1900,
        2 * PAGE.partyX - UA.x1, 2 * PAGE.partyX - a.v2, t,
        [{from: 2 * PAGE.partyX - 5000, to: 2 * PAGE.partyX - 4400}]);
}

// Filled rectangle for a wall segment, splitting around any gap.
function drawWithGaps(o, isHoriz, axis, from, to, half, gaps) {
    const segments = subtractGaps(from, to, gaps);
    for (const [a, b] of segments) {
        if (isHoriz) fillRect(o, a, axis - half, b, axis + half);
        else         fillRect(o, axis - half, a, axis + half, b);
    }
}

function subtractGaps(from, to, gaps) {
    if (!gaps.length) return [[from, to]];
    const sorted = gaps.slice().sort((p, q) => p.from - q.from);
    const out = [];
    let cur = from;
    for (const g of sorted) {
        if (g.from > cur) out.push([cur, g.from]);
        cur = Math.max(cur, g.to);
    }
    if (cur < to) out.push([cur, to]);
    return out;
}


// ─────────────────────────────────────────────────────────────────
// 5. Wall outlines (heavy stroke for the building envelope, lighter
//    for party + interior partitions).
// ─────────────────────────────────────────────────────────────────

function wallOutlines(o) {
    // Heavy outer envelope.
    o.push(RGOp(INK.wallLine));
    o.push(wOp(8));
    strokeRect(o, PAGE.bx0, PAGE.by0, PAGE.bx1, PAGE.by1);

    // Inner face of exterior walls (drawn against poché).
    o.push(wOp(4));
    const T = PAGE.extWallT;
    strokeRect(o, PAGE.bx0 + T, PAGE.by0 + T, PAGE.bx1 - T, PAGE.by1 - T);

    // Party wall outlines (left + right faces).
    o.push(wOp(4));
    const px0 = PAGE.partyX - PAGE.partyT * 0.5;
    const px1 = PAGE.partyX + PAGE.partyT * 0.5;
    const yT = PAGE.by1 - PAGE.extWallT;
    const yB = PAGE.by0 + PAGE.extWallT;
    o.push(`${f(px0)} ${f(yB)} m ${f(px0)} ${f(yT)} l S`);
    o.push(`${f(px1)} ${f(yB)} m ${f(px1)} ${f(yT)} l S`);
}


// ─────────────────────────────────────────────────────────────────
// 6. Windows — three thin parallel lines spanning the wall thickness.
// ─────────────────────────────────────────────────────────────────

function windowMarks(o) {
    o.push(RGOp(INK.window));
    o.push(wOp(2.4));

    const drawWindow = (wall, from, to) => {
        const T = PAGE.extWallT;
        switch (wall) {
            case "S": triple(o, from, PAGE.by0, to, PAGE.by0 + T, /*horiz*/true);   break;
            case "N": triple(o, from, PAGE.by1 - T, to, PAGE.by1, /*horiz*/true);   break;
            case "W": triple(o, PAGE.bx0, from, PAGE.bx0 + T, to, /*horiz*/false);  break;
            case "E": triple(o, PAGE.bx1 - T, from, PAGE.bx1, to, /*horiz*/false);  break;
        }
    };
    // Unit A windows.
    for (const w of WINDOWS_A) drawWindow(w.wall, w.from, w.to);
    // Unit B — east wall instead of west, S/N mirrored along x.
    for (const w of WINDOWS_A) {
        const flippedWall = w.wall === "W" ? "E" : w.wall;
        const flippedFrom = (w.wall === "S" || w.wall === "N")
            ? 2 * PAGE.partyX - w.to
            : w.from;
        const flippedTo   = (w.wall === "S" || w.wall === "N")
            ? 2 * PAGE.partyX - w.from
            : w.to;
        drawWindow(flippedWall, flippedFrom, flippedTo);
    }
}

function triple(o, x0, y0, x1, y1, horiz) {
    // Erase the wall poché with a white fill, then three thin strokes.
    o.push(rgOp([1, 1, 1]));
    fillRect(o, x0, y0, x1, y1);
    o.push(RGOp(INK.window));
    if (horiz) {
        const mid = (y0 + y1) * 0.5;
        o.push(`${f(x0)} ${f(y0)} m ${f(x1)} ${f(y0)} l S`);
        o.push(`${f(x0)} ${f(mid)} m ${f(x1)} ${f(mid)} l S`);
        o.push(`${f(x0)} ${f(y1)} m ${f(x1)} ${f(y1)} l S`);
    } else {
        const mid = (x0 + x1) * 0.5;
        o.push(`${f(x0)} ${f(y0)} m ${f(x0)} ${f(y1)} l S`);
        o.push(`${f(mid)} ${f(y0)} m ${f(mid)} ${f(y1)} l S`);
        o.push(`${f(x1)} ${f(y0)} m ${f(x1)} ${f(y1)} l S`);
    }
}


// ─────────────────────────────────────────────────────────────────
// 7. Doors — leaf + 90° swing arc (cubic-bezier approx of quarter circle)
// ─────────────────────────────────────────────────────────────────

function doors(o) {
    o.push(RGOp(INK.door));
    o.push(wOp(2.5));
    for (const d of DOORS_A) drawDoor(o, d.x, d.y, d.w, d.hingedAt, d.swingTo);
    for (const d of DOORS_A) {
        // Mirror across partyX (swing/hinge sides flip on E/W).
        const mx = 2 * PAGE.partyX - d.x - d.w;
        const flipHinge = {SW:"SE", SE:"SW", NW:"NE", NE:"NW"}[d.hingedAt];
        const flipSwing = {N:"N", S:"S", E:"W", W:"E"}[d.swingTo] || d.swingTo;
        drawDoor(o, mx, d.y, d.w, flipHinge, flipSwing);
    }
}

function drawDoor(o, x, y, w, hingedAt, swingTo) {
    // Door opens off a horizontal wall at y, occupying x..(x+w).
    // Hinge corner determines the leaf endpoint + arc centre.
    const r = w;
    const k = 0.5522847498 * r;
    // Hinge positions (corner of the opening).
    let hx, hy, sx, sy;       // hinge xy, leaf-tip xy
    switch (hingedAt) {
        case "SW": hx = x;     hy = y; sx = x;     sy = y + (swingTo === "S" ? -r : r); break;
        case "SE": hx = x + w; hy = y; sx = x + w; sy = y + (swingTo === "S" ? -r : r); break;
        case "NW": hx = x;     hy = y; sx = x;     sy = y + (swingTo === "S" ? -r : r); break;
        case "NE": hx = x + w; hy = y; sx = x + w; sy = y + (swingTo === "S" ? -r : r); break;
    }
    // Leaf (the door, fully open). Slim solid line from hinge along the
    // perpendicular (we draw it at the open angle: along the y axis).
    o.push(`${f(hx)} ${f(hy)} m ${f(sx)} ${f(sy)} l S`);

    // Swing arc: from leaf-tip (sx, sy) to the latch corner (closed
    // position on the wall). Latch corner is opposite hinge along x.
    let lx;
    if (hingedAt === "SW" || hingedAt === "NW") lx = x + w; else lx = x;
    const ly = y;
    const yDir = swingTo === "S" ? -1 : 1;

    o.push(wOp(0.8));
    // Quarter-circle from (sx, sy) → (lx, ly), centred at (hx, hy).
    // Two control points each at distance k from the endpoints along
    // the tangent direction.
    moveTo(o, sx, sy);
    if (hx === x) {            // hinge on west side: arc swings east
        curveTo(o, sx + k, sy, lx, ly + yDir * k, lx, ly);
    } else {                   // hinge on east side: arc swings west
        curveTo(o, sx - k, sy, lx, ly + yDir * k, lx, ly);
    }
    o.push(`S`);
    o.push(wOp(2.5));
}


// ─────────────────────────────────────────────────────────────────
// 8. Fixtures + stairs
// ─────────────────────────────────────────────────────────────────

function fixtures(o) {
    drawStair(o);
    drawBath(o);
    drawKitchen(o);
    drawPowder(o);
}

// Stairs: parallel tread lines + a centreline arrow showing UP.
function drawStair(o) {
    const tread = 280;        // 280mm typical
    const treads = 9;
    o.push(RGOp(INK.stair));
    o.push(wOp(1.5));

    const drawForUnit = (x0, x1) => {
        const yStart = PAGE.extWallT + 100;
        // Treads run W↔E along x, advancing north.
        for (let i = 1; i <= treads; i++) {
            const y = yStart + i * tread;
            o.push(`${f(x0)} ${f(y)} m ${f(x1)} ${f(y)} l S`);
        }
        // UP arrow centred along the run.
        const cx = (x0 + x1) * 0.5;
        const yArrowStart = yStart + tread * 1;
        const yArrowEnd   = yStart + tread * (treads - 0.5);
        o.push(RGOp(INK.stairArrow));
        o.push(wOp(2.0));
        o.push(`${f(cx)} ${f(yArrowStart)} m ${f(cx)} ${f(yArrowEnd)} l S`);
        // Arrowhead.
        const ah = 180;
        o.push(`${f(cx - ah * 0.5)} ${f(yArrowEnd - ah)} m ${f(cx)} ${f(yArrowEnd)} l ${f(cx + ah * 0.5)} ${f(yArrowEnd - ah)} l S`);
        o.push(RGOp(INK.stair));
        o.push(wOp(1.5));
    };
    drawForUnit(PART_A.v1, PART_A.v2);
    drawForUnit(2 * PAGE.partyX - PART_A.v2, 2 * PAGE.partyX - PART_A.v1);
}

function drawBath(o) {
    const drawForUnit = (xMin, xMax) => {
        // Bath room is (xMin..xMax) × (8500..10000), Unit A => x: 250..2200.
        // Tub along the west wall (xMin..xMin+750, 8800..10000).
        const tubX0 = xMin + 80, tubX1 = xMin + 800;
        const tubY0 = 8700,      tubY1 = 9950;
        o.push(RGOp(INK.fixture));
        o.push(wOp(1.4));
        strokeRect(o, tubX0, tubY0, tubX1, tubY1);
        // Inner basin (rounded rectangle approximated as inset rectangle
        // with small fillet corners — render as smaller rect for the test).
        strokeRect(o, tubX0 + 120, tubY0 + 120, tubX1 - 120, tubY1 - 240);

        // Toilet: circle + tank on inner wall (south side).
        const tx = xMin + 350, ty = 8800;
        o.push(wOp(1.2));
        circlePath(o, tx, ty, 180);
        o.push(`S`);
        strokeRect(o, tx - 220, ty - 160, tx + 220, ty - 360);    // tank

        // Sink: square + circle, near south wall.
        const sx = xMax - 500, sy = 8900;
        strokeRect(o, sx - 250, sy - 250, sx + 250, sy + 250);
        circlePath(o, sx, sy, 150);
        o.push(`S`);
    };
    drawForUnit(UA.x0, PART_A.v4);
    drawForUnit(2 * PAGE.partyX - PART_A.v4, 2 * PAGE.partyX - UA.x0);
}

function drawKitchen(o) {
    const drawForUnit = (xMin, xMax) => {
        // Kitchen is (v5=3000..5150) × (h2=7500..h3=10000). Counter
        // wraps the north + east walls in an L. Range + sink + fridge.
        o.push(RGOp(INK.fixture));
        o.push(wOp(1.4));
        const cT = 600;           // counter depth (mm)
        // North counter strip.
        strokeRect(o, xMin + 30, PART_A.h3 - cT, xMax - 30, PART_A.h3 - 30);
        // East counter strip (clear of north counter).
        strokeRect(o, xMax - cT, PART_A.h2 + 30, xMax - 30, PART_A.h3 - cT - 30);

        // Sink (under-counter, indicated as inset rectangle).
        const sinkCx = xMin + 1200, sinkCy = PART_A.h3 - cT * 0.5;
        strokeRect(o, sinkCx - 380, sinkCy - 220, sinkCx + 380, sinkCy + 220);
        // Bowl divider.
        o.push(`${f(sinkCx)} ${f(sinkCy - 220)} m ${f(sinkCx)} ${f(sinkCy + 220)} l S`);

        // Range — four burners.
        const rangeCx = xMin + 2700, rangeCy = PART_A.h3 - cT * 0.5;
        strokeRect(o, rangeCx - 300, rangeCy - 300, rangeCx + 300, rangeCy + 300);
        o.push(wOp(1.0));
        for (const [dx, dy] of [[-150, -150], [150, -150], [-150, 150], [150, 150]]) {
            circlePath(o, rangeCx + dx, rangeCy + dy, 90);
            o.push(`S`);
        }
        o.push(wOp(1.4));

        // Fridge — taller rectangle on east counter.
        const fdgCx = xMax - cT * 0.5;
        const fdgCy = PART_A.h2 + 500;
        strokeRect(o, fdgCx - cT * 0.5, fdgCy - 350, fdgCx + cT * 0.5, fdgCy + 350);
        // Door hinge mark.
        o.push(`${f(fdgCx - cT * 0.5)} ${f(fdgCy + 350)} m ${f(fdgCx + cT * 0.5)} ${f(fdgCy - 350)} l S`);
    };
    drawForUnit(PART_A.v5, UA.x1);
    drawForUnit(2 * PAGE.partyX - UA.x1, 2 * PAGE.partyX - PART_A.v5);
}

function drawPowder(o) {
    const drawForUnit = (xMin, xMax) => {
        o.push(RGOp(INK.fixture));
        o.push(wOp(1.2));
        // Toilet south side of room (y from 1900 to 2900, x v2=4000..5150).
        const tx = xMin + 250, ty = 2200;
        circlePath(o, tx, ty, 150);
        o.push(`S`);
        strokeRect(o, tx - 180, ty - 130, tx + 180, ty - 280);
        // Pedestal sink north side.
        const sx = xMax - 350, sy = 2700;
        strokeRect(o, sx - 200, sy - 180, sx + 200, sy + 180);
        circlePath(o, sx, sy, 120);
        o.push(`S`);
    };
    drawForUnit(PART_A.v2, UA.x1);
    drawForUnit(2 * PAGE.partyX - UA.x1, 2 * PAGE.partyX - PART_A.v2);
}


// ─────────────────────────────────────────────────────────────────
// 9. Grid — dashed lines + circle bubbles with labels.
// ─────────────────────────────────────────────────────────────────

function grid(o) {
    o.push(RGOp(INK.grid));
    o.push(wOp(2));
    o.push(dOp([60, 30, 12, 30]));

    const xs = [PAGE.bx0, PAGE.partyX, PAGE.bx1];        // A, B, C
    const ys = [PAGE.by0, 2900, 7500, 10000, PAGE.by1];  // 1..5
    const labelsX = ["A", "B", "C"];
    const labelsY = ["1", "2", "3", "4", "5"];

    const extLeft  = -2000;
    const extRight = PAGE.bx1 + 2000;
    const extBot   = -2000;
    const extTop   = PAGE.by1 + 2000;

    // Vertical grid lines (labelled A/B/C) extend top + bottom.
    for (const x of xs) {
        o.push(`${f(x)} ${f(extBot)} m ${f(x)} ${f(extTop)} l S`);
    }
    // Horizontal grid lines (labelled 1..5).
    for (const y of ys) {
        o.push(`${f(extLeft)} ${f(y)} m ${f(extRight)} ${f(y)} l S`);
    }
    o.push(dOp([]));

    // Bubbles + letters at both ends of each grid line.
    o.push(RGOp(INK.gridBub));
    o.push(rgOp([1, 1, 1]));
    const R = 400;
    const bubble = (cx, cy, label) => {
        // Filled white circle, then stroke + text.
        o.push(rgOp([1, 1, 1]));
        circlePath(o, cx, cy, R);
        o.push(`f`);
        o.push(RGOp(INK.gridBub));
        o.push(wOp(2.5));
        circlePath(o, cx, cy, R);
        o.push(`S`);
        o.push(rgOp(INK.gridBub));
        // Centre the text roughly — Helvetica advance is ~0.55em, so
        // a single-char label needs ~half a char-width of left bias.
        const sz = 380;
        const tx = cx - sz * 0.28;
        const ty = cy - sz * 0.30;
        o.push(`BT /F2 ${sz} Tf 1 0 0 1 ${f(tx)} ${f(ty)} Tm (${label}) Tj ET`);
    };

    for (let i = 0; i < xs.length; i++) {
        bubble(xs[i], extBot - 500, labelsX[i]);
        bubble(xs[i], extTop + 500, labelsX[i]);
    }
    for (let j = 0; j < ys.length; j++) {
        bubble(extLeft - 500, ys[j], labelsY[j]);
        bubble(extRight + 500, ys[j], labelsY[j]);
    }
}


// ─────────────────────────────────────────────────────────────────
// 10. Dimensions — running chain along south + west sides.
// ─────────────────────────────────────────────────────────────────

function dimensions(o) {
    o.push(RGOp(INK.dim));
    o.push(wOp(1.5));

    const tickH = 180;
    const labelGap = 160;

    // South-side running dimension. y = -2500 mm.
    const dimY = -2500;
    const xs = [PAGE.bx0, PAGE.partyX, PAGE.bx1];
    o.push(`${f(xs[0])} ${f(dimY)} m ${f(xs[xs.length - 1])} ${f(dimY)} l S`);
    for (const x of xs) {
        o.push(`${f(x)} ${f(dimY - tickH * 0.5)} m ${f(x)} ${f(dimY + tickH * 0.5)} l S`);
    }
    for (let i = 0; i < xs.length - 1; i++) {
        const mid = (xs[i] + xs[i + 1]) * 0.5;
        const w = xs[i + 1] - xs[i];
        o.push(`BT /F1 320 Tf 1 0 0 1 ${f(mid - 400)} ${f(dimY + labelGap)} Tm (${(w / 1000).toFixed(2)} m) Tj ET`);
    }
    // Overall dim below.
    const overY = dimY - 700;
    o.push(`${f(xs[0])} ${f(overY)} m ${f(xs[xs.length - 1])} ${f(overY)} l S`);
    o.push(`${f(xs[0])} ${f(overY - tickH * 0.5)} m ${f(xs[0])} ${f(overY + tickH * 0.5)} l S`);
    o.push(`${f(xs[xs.length - 1])} ${f(overY - tickH * 0.5)} m ${f(xs[xs.length - 1])} ${f(overY + tickH * 0.5)} l S`);
    const totW = (xs[xs.length - 1] - xs[0]) / 1000;
    o.push(`BT /F2 360 Tf 1 0 0 1 ${f((xs[0] + xs[xs.length - 1]) * 0.5 - 600)} ${f(overY + labelGap)} Tm (${totW.toFixed(2)} m) Tj ET`);

    // West-side dimension chain.
    const dimX = -2500;
    const ys = [PAGE.by0, PART_A.h1, PART_A.h2, PART_A.h3, PAGE.by1];
    o.push(`${f(dimX)} ${f(ys[0])} m ${f(dimX)} ${f(ys[ys.length - 1])} l S`);
    for (const y of ys) {
        o.push(`${f(dimX - tickH * 0.5)} ${f(y)} m ${f(dimX + tickH * 0.5)} ${f(y)} l S`);
    }
    for (let i = 0; i < ys.length - 1; i++) {
        const mid = (ys[i] + ys[i + 1]) * 0.5;
        const h = ys[i + 1] - ys[i];
        o.push(`BT /F1 320 Tf 1 0 0 1 ${f(dimX - 1500)} ${f(mid)} Tm (${(h / 1000).toFixed(2)} m) Tj ET`);
    }
    const overX = dimX - 700;
    o.push(`${f(overX)} ${f(ys[0])} m ${f(overX)} ${f(ys[ys.length - 1])} l S`);
    o.push(`${f(overX - tickH * 0.5)} ${f(ys[0])} m ${f(overX + tickH * 0.5)} ${f(ys[0])} l S`);
    o.push(`${f(overX - tickH * 0.5)} ${f(ys[ys.length - 1])} m ${f(overX + tickH * 0.5)} ${f(ys[ys.length - 1])} l S`);
    const totH = (ys[ys.length - 1] - ys[0]) / 1000;
    o.push(`BT /F2 360 Tf 1 0 0 1 ${f(overX - 1800)} ${f((ys[0] + ys[ys.length - 1]) * 0.5)} Tm (${totH.toFixed(2)} m) Tj ET`);
}


// ─────────────────────────────────────────────────────────────────
// 11. North arrow — circle with "N", arrow pointing up.
// ─────────────────────────────────────────────────────────────────

function northArrow(o) {
    const cx = PAGE.bx1 + 2500;
    const cy = PAGE.by1 - 1000;
    const R = 700;

    // Outer circle.
    o.push(rgOp([1, 1, 1]));
    circlePath(o, cx, cy, R);
    o.push(`f`);
    o.push(RGOp(INK.north));
    o.push(wOp(3));
    circlePath(o, cx, cy, R);
    o.push(`S`);

    // Arrow triangle (filled).
    o.push(rgOp(INK.north));
    moveTo(o, cx,           cy + R * 0.85);
    lineTo(o, cx + R * 0.30, cy - R * 0.55);
    lineTo(o, cx,           cy - R * 0.10);
    lineTo(o, cx - R * 0.30, cy - R * 0.55);
    o.push(`h f`);

    // "N" label above.
    o.push(`BT /F2 360 Tf 1 0 0 1 ${f(cx - 120)} ${f(cy + R + 200)} Tm (N) Tj ET`);
}


// ─────────────────────────────────────────────────────────────────
// 12. Title block — boxed strip on the right edge of the page.
// ─────────────────────────────────────────────────────────────────

function titleBlock(o) {
    const x0 = PAGE.bx1 + 1500;
    const x1 = PAGE.urx  - 300;
    const y0 = PAGE.by0;
    const y1 = PAGE.by0 + 4000;

    // Frame.
    o.push(RGOp(INK.titleLine));
    o.push(wOp(4));
    strokeRect(o, x0, y0, x1, y1);

    // Internal dividers.
    o.push(wOp(2));
    const rows = [y0 + 800, y0 + 1600, y0 + 2400, y0 + 3200];
    for (const r of rows) {
        o.push(`${f(x0)} ${f(r)} m ${f(x1)} ${f(r)} l S`);
    }

    // Labels.
    o.push(rgOp(INK.titleText));
    const lab = (sz, x, y, str, bold) => `BT /${bold ? "F2" : "F1"} ${sz} Tf 1 0 0 1 ${f(x)} ${f(y)} Tm (${str}) Tj ET`;
    o.push(lab(420, x0 + 150, y1 - 600,            "DUPLEX APARTMENT", true));
    o.push(lab(260, x0 + 150, y1 - 950,            "Level 1 / Ground Floor"));
    o.push(lab(220, x0 + 150, y0 + 3200 + 250,     "Scale  1 : 50"));
    o.push(lab(220, x0 + 150, y0 + 2400 + 250,     "Drawn   xeokit demo"));
    o.push(lab(220, x0 + 150, y0 + 1600 + 250,     "Date    May 2026"));
    o.push(lab(220, x0 + 150, y0 +  800 + 250,     "Project DUP-26"));
    o.push(lab(560, x0 + 150, y0 +  200,           "A-101", true));
}


// ─────────────────────────────────────────────────────────────────
// 13. Room labels — name + computed area.
// ─────────────────────────────────────────────────────────────────

function roomLabels(o) {
    o.push(rgOp([0.05, 0.05, 0.05]));
    for (const r of allRooms()) {
        const cx = (r.x0 + r.x1) * 0.5;
        const cy = (r.y0 + r.y1) * 0.5;
        const area = ((r.x1 - r.x0) * (r.y1 - r.y0) / 1e6).toFixed(1);
        const labelSize = Math.min(380, Math.max(180, (r.x1 - r.x0) * 0.08));
        const areaSize  = labelSize * 0.65;
        o.push(`BT /F2 ${labelSize} Tf 1 0 0 1 ${f(cx - r.name.length * labelSize * 0.25)} ${f(cy + labelSize * 0.2)} Tm (${r.name}) Tj ET`);
        o.push(`BT /F1 ${areaSize}  Tf 1 0 0 1 ${f(cx - (area.length + 3) * areaSize * 0.25)} ${f(cy - areaSize * 1.1)} Tm (${area} m²) Tj ET`);
    }
}


// ─────────────────────────────────────────────────────────────────
// 14. PDF byte helpers.
// ─────────────────────────────────────────────────────────────────

function escapePdfString(s) {
    return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pad10(n) {
    const s = String(n);
    return "0".repeat(Math.max(0, 10 - s.length)) + s;
}
