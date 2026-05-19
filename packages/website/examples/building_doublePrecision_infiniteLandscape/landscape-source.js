// External instruction source for the infinite-landscape demo.
//
// Knows nothing about xeokit. Given the current pan offset, it emits a
// stream of building "instructions" — one per pool slot — describing
// what that slot should look like RIGHT NOW (geometry type, transform,
// colour, opacity, plus a `hidden` flag).
//
// Architecture: GROUPS, not slots
// -------------------------------
// Slots are organised into fixed-size groups of `GROUP_SIZE`. Each
// group has a single anchor position on a window-sized lattice and a
// pattern type. Per frame the caller passes the *camera's* world XY
// position; the source picks, for each group, the multiple of the
// window width/height that places its anchor closest to the camera.
// As the camera roams, most groups stay put — only the ones that
// fall outside the window switch to a different multiple, which ticks
// their wrap counter and reseeds their pattern. Stand still and the
// flow stops; move and buildings recycle past you.
//
// A *pattern* is a parametric layout that fills the group's K slots —
// one tall tower + one podium slab, four cylinders + four dome caps
// arranged as a tank farm, a 2×2 office quadrant, a refinery, a
// cathedral, a castle, a stadium ring, a suspension bridge with cables,
// an apartment tower bristling with balconies, etc. Patterns can leave
// members "hidden" (parked by the renderer); not every group has to
// fill every slot.
//
// The instruction stream the demo consumes is still flat — `slotCount`
// instructions per frame, in slotId order — but consecutive slots
// belonging to the same group cooperate to compose one complex object.
//
// Member descriptor format
// ------------------------
//   { hidden, geomType, dx, dy, dz, sx, sy, sz, rotation, color }
//
// `dx, dy, dz` are group-local position offsets (the renderer adds
// them to the wrapped anchor to get world position). `rotation` is a
// 3-element Euler XYZ vector in radians — patterns can tilt elements
// around any axis to do things like bridge cables or angled
// construction-crane jibs.
//
// In a real system the source could be a recorded clip, a server-
// streamed feed, or anything else producing per-frame state. Index.js
// only knows the instruction shape.

export const GEOM_BOX      = 0;
export const GEOM_SLAB     = 1;
export const GEOM_CYLINDER = 2;
export const GEOM_DOME     = 3;

const GROUP_SIZE = 16;  // every group owns this many slots

export function createLandscapeSource({
  slotCount = 1024,
  windowWidth = 280,
  windowHeight = 280,
  seed = 1
} = {}) {
  // Round slot count up to a multiple of GROUP_SIZE so every group is
  // full. Actual slots reported back via the returned `.slotCount`.
  const groupCount = Math.ceil(slotCount / GROUP_SIZE);
  const totalSlots = groupCount * GROUP_SIZE;

  // Lay groups on a near-square lattice covering the window, with
  // per-group jitter so the city doesn't read as a regular grid.
  const cols = Math.max(1, Math.round(Math.sqrt(groupCount * windowWidth / windowHeight)));
  const rows = Math.ceil(groupCount / cols);
  const cellW = windowWidth / cols;
  const cellH = windowHeight / rows;

  const groups = [];
  let g = 0;
  for (let cy = 0; cy < rows && g < groupCount; cy++) {
    for (let cx = 0; cx < cols && g < groupCount; cx++) {
      const j1 = hash11(seed * 13 + g * 9171);
      const j2 = hash11(seed * 17 + g * 7193);
      groups.push({
        id: g,
        anchorBaseX: (cx + 0.18 + 0.64 * j1) * cellW - windowWidth * 0.5,
        anchorBaseY: (cy + 0.18 + 0.64 * j2) * cellH - windowHeight * 0.5,
        firstSlot: g * GROUP_SIZE
      });
      g++;
    }
  }

  // Reusable instruction array — `totalSlots` entries, mutated in place
  // each frame. Hidden slots have `hidden: true`; the renderer parks
  // their active mesh.
  const out = new Array(totalSlots);
  for (let k = 0; k < totalSlots; k++) {
    out[k] = {
      slotId:   k,
      hidden:   true,
      geomType: 0,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale:    [1, 1, 1],
      color:    [1, 1, 1],
      opacity:  1
    };
  }

  // Scratch member buffer reused across patterns to avoid allocations
  // in the per-frame hot path. Patterns mutate these in place; the
  // outer loop copies into the flat instruction array.
  const memberOut = new Array(GROUP_SIZE);
  for (let k = 0; k < GROUP_SIZE; k++) {
    memberOut[k] = {
      hidden:   true,
      geomType: 0,
      dx: 0, dy: 0, dz: 0,
      sx: 1, sy: 1, sz: 1,
      rotation: [0, 0, 0],
      color: [1, 1, 1]
    };
  }

  function nextFrame(cameraX, cameraY) {
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];

      // Place this group at the world position closest to the camera —
      // pick the integer (wrapX, wrapY) tile offsets that minimise
      // distance from (cameraX, cameraY) to (anchorBase + offset *
      // windowSize). Buildings stay at fixed world positions until
      // the camera crosses far enough that a different tile is closer,
      // at which point this slot's wrap counter ticks and the hash
      // re-rolls its pattern — recycling that slot to the front.
      const wrapX = Math.round((cameraX - group.anchorBaseX) / windowWidth);
      const wrapY = Math.round((cameraY - group.anchorBaseY) / windowHeight);
      const ax = group.anchorBaseX + wrapX * windowWidth;
      const ay = group.anchorBaseY + wrapY * windowHeight;

      const tag = group.id * 73856093 ^ wrapX * 19349663 ^ wrapY * 83492791 ^ seed * 314159;
      const rng = makeRng(tag);

      applyPattern(rng, memberOut);

      const base = group.firstSlot;
      for (let k = 0; k < GROUP_SIZE; k++) {
        const src = memberOut[k];
        const dst = out[base + k];
        dst.slotId = base + k;
        dst.hidden = src.hidden;
        if (src.hidden) continue;
        dst.geomType    = src.geomType;
        dst.position[0] = ax + src.dx;
        dst.position[1] = ay + src.dy;
        dst.position[2] = src.dz;
        dst.rotation[0] = src.rotation[0];
        dst.rotation[1] = src.rotation[1];
        dst.rotation[2] = src.rotation[2];
        dst.scale[0]    = src.sx;
        dst.scale[1]    = src.sy;
        dst.scale[2]    = src.sz;
        dst.color[0]    = src.color[0];
        dst.color[1]    = src.color[1];
        dst.color[2]    = src.color[2];
        dst.opacity     = 1.0;
      }
    }
    return out;
  }

  return {
    nextFrame,
    slotCount: totalSlots,
    groupSize: GROUP_SIZE,
    windowWidth,
    windowHeight
  };
}

// ---------------------------------------------------------------------
// Patterns
//
// Each pattern populates the group's K member slots with descriptors
// in *group-local* space. The renderer adds the wrapped anchor when
// converting to world coordinates. Members not used by a pattern are
// left in their default `hidden: true` state.
//
// Patterns are weighted via PATTERN_PICK_TABLE — repeat an index in
// the table to make that pattern more common. Multi-member elaborate
// patterns are weighted up so the city stays dense.
// ---------------------------------------------------------------------

const PATTERNS = [
  patternRefinery,            // 16 members — fractionators + tank farm + flare
  patternCathedral,           // 16 members — nave + transept + spire + pinnacles
  patternCastle,              // 16 members — keep + 4 corner towers + curtain walls
  patternStadium,             // 16 members — octagonal stand + 4 floodlight towers
  patternApartmentBalconies,  // 16 members — tower + elevator shafts + balconies
  patternSuspensionBridge,    // 16 members — paired pylons + cables + piers
  patternSteppedPyramid,      // 16 members — wedding-cake tiers + corner stairwells
  patternChemicalPlant,       // 16 members — multi-column refinery cluster
  patternConstructionCrane,   // 16 members — partial frame + crane mast + scaffolding
  patternColonnadeTemple,     // 16 members — peristyle of cylinders + cella + dome
  patternPowerPlant,          // 16 members — cooling towers + reactor dome + switchyard
  patternLighthouse,          // 16 members — striped tower + outbuildings + dock
  patternTrainStation,        // 16 members — platform + canopy + clock tower
  patternTowerPodium,         //  2 members — single-tower cameo
  patternMixedCluster         //  4 members — palette-cleanser cameo
];

const PATTERN_PICK_TABLE = [
  0, 0, 0,        // refinery         ×3
  1, 1, 1,        // cathedral        ×3
  2, 2,           // castle           ×2
  3, 3,           // stadium          ×2
  4, 4, 4,        // apartment        ×3
  5, 5,           // bridge           ×2
  6, 6,           // stepped pyramid  ×2
  7, 7, 7,        // chemical plant   ×3
  8,              // construction     ×1
  9, 9, 9,        // colonnade        ×3
  10, 10, 10,     // power plant      ×3
  11, 11,         // lighthouse       ×2
  12, 12,         // train station    ×2
  13,             // tower+podium     ×1
  14              // mixed cluster    ×1
];

function applyPattern(rng, members) {
  for (let k = 0; k < members.length; k++) members[k].hidden = true;
  const pickIdx = Math.floor(rng() * PATTERN_PICK_TABLE.length) % PATTERN_PICK_TABLE.length;
  PATTERNS[PATTERN_PICK_TABLE[pickIdx]](rng, members);
}

// ─── 1. Refinery — cylinder forest ──────────────────────────────────
// 4 fractionating columns of staggered heights, 3 storage tanks
// (cylinder + dome cap pairs), a wide cooling tower, a flare stack
// with a flame cap, a chimney, a pipe-rack support, and one control
// office. 16 members; 13 are cylinders/domes.
function patternRefinery(rng, m) {
  const baseHue   = rng() * 0.10 + 0.55;
  const colA      = hslToRgb(baseHue + 0.02, 0.50, 0.60);
  const colB      = hslToRgb(baseHue + 0.08, 0.55, 0.65);
  const colC      = hslToRgb(baseHue + 0.14, 0.45, 0.55);
  const tankColA  = hslToRgb(baseHue + 0.20, 0.50, 0.62);
  const tankColB  = hslToRgb(baseHue + 0.05, 0.55, 0.66);
  const tankColC  = hslToRgb(baseHue + 0.30, 0.50, 0.60);
  const officeCol = hslToRgb(baseHue + 0.50, 0.65, 0.55);
  const flareCol  = hslToRgb(0.06, 0.95, 0.55);

  // 4 fractionating columns — *very* tall (22-38 m), staggered.
  const colSpec = [
    [colA, 24, 0.95], [colB, 34, 1.10],
    [colC, 20, 0.85], [colA, 30, 1.00]
  ];
  for (let i = 0; i < 4; i++) {
    const [c, h, r] = colSpec[i];
    setMember(m[i], false, GEOM_CYLINDER,
      -11 + i * 2.4, -7,
      r, r, h + rng() * 3,
      [0, 0, 0], c);
  }

  // 3 storage tank + dome-cap pairs (6 members).
  const tankPos = [[5, -8], [10, -3], [5, 3]];
  const tankCols = [tankColA, tankColB, tankColC];
  for (let i = 0; i < 3; i++) {
    const [tx, ty] = tankPos[i];
    const tankH = 5 + rng() * 4;
    const tankR = 2.0 + rng() * 0.5;
    setMember(m[4 + i * 2],     false, GEOM_CYLINDER, tx, ty, tankR, tankR, tankH,
      [0, 0, 0], tankCols[i]);
    setMember(m[4 + i * 2 + 1], false, GEOM_DOME,     tx, ty, tankR * 1.05, tankR * 1.05, tankR * 1.4,
      [0, 0, 0], tankCols[i], /*dz=*/tankH + tankR * 0.3);
  }

  // Wide cooling tower.
  setMember(m[10], false, GEOM_CYLINDER, 11, 8, 2.6, 2.6, 16,
    [0, 0, 0], hslToRgb(baseHue + 0.02, 0.35, 0.70));

  // Flare stack — very thin, very tall + bright flame cap.
  setMember(m[11], false, GEOM_CYLINDER, -11, 8, 0.5, 0.5, 32,
    [0, 0, 0], hslToRgb(baseHue, 0.30, 0.50));
  setMember(m[12], false, GEOM_DOME,     -11, 8, 0.9, 0.9, 1.8,
    [0, 0, 0], flareCol, /*dz=*/32.9);

  // Chimney.
  setMember(m[13], false, GEOM_CYLINDER, -5, 7, 0.95, 0.95, 22,
    [0, 0, 0], hslToRgb(baseHue + 0.04, 0.40, 0.55));

  // Pipe-rack support — slim cylinder.
  setMember(m[14], false, GEOM_CYLINDER, 0, 0, 0.45, 0.45, 12,
    [0, 0, 0], colC);

  // Control office (slab).
  setMember(m[15], false, GEOM_SLAB, 0, 9, 5, 3, 4.5, [0, 0, 0], officeCol);
}

// ─── 2. Cathedral — towering spire, bell towers, colonnade ──────────
// Cruciform plan with a 30 m central spire (cylinder + gold dome cap),
// 6 colonnade columns flanking the nave, 2 cylindrical bell towers
// with dome caps, and an apsidal half-dome at the back. 16 members.
function patternCathedral(rng, m) {
  const stoneHue = rng() * 0.08 + 0.07;
  const stoneCol  = hslToRgb(stoneHue,        0.40, 0.68);
  const stoneCol2 = hslToRgb(stoneHue + 0.03, 0.45, 0.74);
  const roofCol   = hslToRgb(stoneHue + 0.55, 0.85, 0.45);
  const goldCol   = hslToRgb(0.13, 0.95, 0.58);

  const naveLen = 14, naveW = 4, naveH = 9;

  // Nave (long slab along Y).
  setMember(m[0], false, GEOM_SLAB, 0, 0, naveW, naveLen, naveH, [0, 0, 0], stoneCol);

  // Transepts perpendicular to nave at the crossing.
  setMember(m[1], false, GEOM_SLAB,  6, 0, 7, naveW, naveH, [0, 0, 0], stoneCol);
  setMember(m[2], false, GEOM_SLAB, -6, 0, 7, naveW, naveH, [0, 0, 0], stoneCol);

  // CENTRAL SPIRE — cylindrical body towering above the crossing,
  // capped by a tapered gold dome. Total spire reaches ~32 m.
  setMember(m[3], false, GEOM_CYLINDER, 0, 0, 1.3, 1.3, 22,
    [0, 0, 0], stoneCol2, /*dz=*/naveH + 11);
  setMember(m[4], false, GEOM_DOME, 0, 0, 1.7, 1.7, 6,
    [0, 0, 0], goldCol, /*dz=*/naveH + 22 + 3.0);

  // 6 colonnade columns — 3 along each side of the nave.
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const yi = i % 3;
    setMember(m[5 + i], false, GEOM_CYLINDER,
      side * (naveW * 0.5 + 1.4),
      (yi - 1) * (naveLen * 0.30),
      0.55, 0.55, naveH + 1,
      [0, 0, 0], stoneCol);
  }

  // Two cylindrical bell towers with dome caps at the front facade.
  setMember(m[11], false, GEOM_CYLINDER, -3.2, -8.5, 1.7, 1.7, 14,
    [0, 0, 0], stoneCol2);
  setMember(m[12], false, GEOM_DOME,     -3.2, -8.5, 2.1, 2.1, 2.6,
    [0, 0, 0], roofCol, /*dz=*/14 + 0.8);
  setMember(m[13], false, GEOM_CYLINDER,  3.2, -8.5, 1.7, 1.7, 14,
    [0, 0, 0], stoneCol2);
  setMember(m[14], false, GEOM_DOME,      3.2, -8.5, 2.1, 2.1, 2.6,
    [0, 0, 0], roofCol, /*dz=*/14 + 0.8);

  // Apsidal half-dome at the back of the nave.
  setMember(m[15], false, GEOM_DOME, 0, 9, 4, 4, 4.8, [0, 0, 0], roofCol);
}

// ─── 3. Castle — round-tower fortress ───────────────────────────────
// Cylindrical keep with conical roof, 4 corner round towers (each a
// cylinder + cone-cap), curtain walls, and 2 cylindrical gate-flanking
// towers. 16 members; 7 cylinders + 5 domes.
function patternCastle(rng, m) {
  const stoneHue  = rng() * 0.08;
  const stoneCol  = hslToRgb(stoneHue, 0.35, 0.62);
  const stoneCol2 = hslToRgb(stoneHue + 0.04, 0.45, 0.66);
  const roofCol   = hslToRgb(0.0, 0.85, 0.42);

  // CYLINDRICAL keep, much taller than corner towers, with conical cap.
  setMember(m[0], false, GEOM_CYLINDER, 0, 0, 3, 3, 18, [0, 0, 0], stoneCol2);
  setMember(m[1], false, GEOM_DOME,     0, 0, 3.5, 3.5, 5,
    [0, 0, 0], roofCol, /*dz=*/18 + 1.4);

  // 4 corner round towers + cone-cap dome.
  const corners = [[-7, -7], [7, -7], [-7, 7], [7, 7]];
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = corners[i];
    const towerH = 12 + rng() * 1.5;
    const towerR = 1.5;
    setMember(m[2 + i * 2], false, GEOM_CYLINDER, cx, cy, towerR, towerR, towerH,
      [0, 0, 0], stoneCol);
    setMember(m[3 + i * 2], false, GEOM_DOME,     cx, cy, towerR * 1.5, towerR * 1.5, towerR * 2.0,
      [0, 0, 0], roofCol, /*dz=*/towerH + towerR * 0.7);
  }

  // 4 curtain walls.
  setMember(m[10], false, GEOM_SLAB,  0, -7, 11, 1.0, 4.5, [0, 0, 0], stoneCol);
  setMember(m[11], false, GEOM_SLAB,  0,  7, 11, 1.0, 4.5, [0, 0, 0], stoneCol);
  setMember(m[12], false, GEOM_SLAB, -7,  0, 1.0, 11, 4.5, [0, 0, 0], stoneCol);
  setMember(m[13], false, GEOM_SLAB,  7,  0, 1.0, 11, 4.5, [0, 0, 0], stoneCol);

  // 2 gate-flanking towers — additional cylinders breaking the south wall.
  setMember(m[14], false, GEOM_CYLINDER, -2.5, -7.5, 1.0, 1.0, 9,
    [0, 0, 0], stoneCol2);
  setMember(m[15], false, GEOM_CYLINDER,  2.5, -7.5, 1.0, 1.0, 9,
    [0, 0, 0], stoneCol2);
}

// ─── 4. Stadium — circular stand with floodlight towers ────────────
// 8 yawed stand segments + 4 corner floodlight towers (tall cylinder +
// halogen-coloured dome head). 16 members; 4 cylinders.
function patternStadium(rng, m) {
  const hue          = rng();
  const standCol     = hslToRgb(hue,         0.60, 0.60);
  const standCol2    = hslToRgb(hue + 0.08,  0.55, 0.65);
  const plazaCol     = hslToRgb(hue + 0.5,   0.45, 0.55);
  const lightCol     = hslToRgb(hue + 0.10,  0.30, 0.78);
  const lightHeadCol = hslToRgb(0.13,        0.95, 0.65);

  const segments = 8, radius = 9;
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    setMember(m[i], false, GEOM_SLAB,
      Math.cos(ang) * radius, Math.sin(ang) * radius,
      6, 2.5, 5 + rng() * 1.5,
      [0, 0, ang + Math.PI / 2],
      i & 1 ? standCol : standCol2);
  }

  // 4 corner floodlight towers — tall cylinders with bright halogen dome heads.
  const lightR = 12;
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lx = Math.cos(ang) * lightR;
    const ly = Math.sin(ang) * lightR;
    setMember(m[8 + i * 2], false, GEOM_CYLINDER, lx, ly, 0.4, 0.4, 20,
      [0, 0, 0], lightCol);
    setMember(m[9 + i * 2], false, GEOM_DOME,     lx, ly, 0.9, 0.9, 0.6,
      [0, 0, 0], lightHeadCol, /*dz=*/20 + 0.25);
  }
}

// ─── 5. Apartment Tower — central tower + cylinder elevator shafts ──
// Central 40 m tower, 4 cylindrical elevator/utility shafts at the
// corners running almost full height, 8 protruding balconies, antenna
// spike (cylinder), roof helipad dome, and a lobby canopy. 16 members;
// 6 cylinders.
function patternApartmentBalconies(rng, m) {
  const hue        = rng();
  const towerCol   = hslToRgb(hue,         0.50, 0.55);
  const balconyCol = hslToRgb(hue,         0.70, 0.70);
  const balconyAlt = hslToRgb(hue + 0.08,  0.70, 0.65);
  const shaftCol   = hslToRgb(hue + 0.05,  0.45, 0.45);
  const helipadCol = hslToRgb(hue + 0.5,   0.85, 0.55);

  const towerH = 38 + rng() * 8;

  // Central tower.
  setMember(m[0], false, GEOM_BOX, 0, 0, 4.5, 4.5, towerH, [0, 0, 0], towerCol);

  // 4 cylindrical elevator/utility shafts at the corners.
  const corners = [[-3, -3], [3, -3], [-3, 3], [3, 3]];
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = corners[i];
    setMember(m[1 + i], false, GEOM_CYLINDER, cx, cy, 0.7, 0.7, towerH * 0.92,
      [0, 0, 0], shaftCol);
  }

  // 8 balconies (4 sides × 2 tiers).
  for (let i = 0; i < 8; i++) {
    const side = i % 4;
    const tier = Math.floor(i / 4);
    const ang  = side * Math.PI / 2;
    const balconyZ = 9 + tier * (towerH - 18);
    setMember(m[5 + i], false, GEOM_SLAB,
      Math.cos(ang) * 3.6, Math.sin(ang) * 3.6,
      3.0, 1.6, 1.2,
      [0, 0, ang],
      i & 1 ? balconyCol : balconyAlt,
      /*dz=*/balconyZ);
  }

  // Antenna spike — thin tall cylinder above the tower.
  setMember(m[13], false, GEOM_CYLINDER, 0, 0, 0.18, 0.18, 8,
    [0, 0, 0], helipadCol, /*dz=*/towerH + 4);

  // Helipad dome.
  setMember(m[14], false, GEOM_DOME, 0, 0, 2.8, 2.8, 1.0,
    [0, 0, 0], helipadCol, /*dz=*/towerH + 0.6);

  // Lobby canopy (low slab) at street level.
  setMember(m[15], false, GEOM_SLAB, 0, -4.5, 6, 2, 1.4,
    [0, 0, 0], balconyCol, /*dz=*/0.9);
}

// ─── 6. Suspension Bridge — paired cylinder pylons + cables + piers ─
// Each "pylon" is two cylindrical towers bracketing the deck; 8 tilted
// cables connect pylon tops to deck; 3 underdeck pier cylinders below.
// 16 members; 14 cylinders + 1 deck slab.
function patternSuspensionBridge(rng, m) {
  const hue      = rng() * 0.10 + 0.55;
  const pylonCol = hslToRgb(hue,        0.60, 0.55);
  const deckCol  = hslToRgb(hue,        0.50, 0.50);
  const cableCol = hslToRgb(hue,        0.30, 0.78);
  const pierCol  = hslToRgb(hue + 0.05, 0.40, 0.45);

  const pylonX = 9, pylonH = 28, deckZ = 8;

  // Each pylon = paired cylindrical towers bracketing the deck.
  setMember(m[0], false, GEOM_CYLINDER, -pylonX, -1, 1.2, 1.2, pylonH,
    [0, 0, 0], pylonCol);
  setMember(m[1], false, GEOM_CYLINDER, -pylonX,  1, 1.2, 1.2, pylonH,
    [0, 0, 0], pylonCol);
  setMember(m[2], false, GEOM_CYLINDER,  pylonX, -1, 1.2, 1.2, pylonH,
    [0, 0, 0], pylonCol);
  setMember(m[3], false, GEOM_CYLINDER,  pylonX,  1, 1.2, 1.2, pylonH,
    [0, 0, 0], pylonCol);

  // Deck.
  setMember(m[4], false, GEOM_SLAB, 0, 0, pylonX * 2 + 4, 5, 0.6,
    [0, 0, 0], deckCol, /*dz=*/deckZ);

  // 8 suspension cables (4 per pylon side) tilted from pylon top
  // toward deck. The cylinder's native axis is now world +Z (it's
  // vertical by default after the geometry-load rotation), so we tilt
  // it into the world X-Z plane by rotating around world Y. R_y(+θ)
  // sends world +Z toward world +X for positive θ, so a positive
  // `tilt` (deck offset in +X from the pylon) wants a positive ry.
  for (let p = 0; p < 2; p++) {
    const px   = (p === 0 ? -1 : 1) * pylonX;
    const sign = p === 0 ? 1 : -1;
    for (let c = 0; c < 4; c++) {
      const deckOff  = (c + 1) * 1.7;
      const deckXAbs = px + sign * deckOff;
      const dx       = deckXAbs - px;
      const dzSpan   = pylonH - deckZ;
      const cableLen = Math.hypot(dx, dzSpan);
      const tilt     = Math.atan2(dx, dzSpan);
      setMember(m[5 + p * 4 + c], false, GEOM_CYLINDER,
        (px + deckXAbs) / 2, 0,
        0.10, 0.10, cableLen,
        [0, tilt, 0],
        cableCol,
        /*dz=*/(pylonH + deckZ) / 2);
    }
  }

  // 3 underdeck pier cylinders supporting the deck centre span.
  for (let i = 0; i < 3; i++) {
    setMember(m[13 + i], false, GEOM_CYLINDER, (i - 1) * 4, 0, 0.7, 0.7, deckZ,
      [0, 0, 0], pierCol);
  }
}

// ─── 7. Stepped Pyramid — Mayan-style with corner accents ──────────
// 6 stepped slab tiers + 4 corner stairwell cylinders + summit shrine
// + dome top + 4 small altar cylinders at the summit corners. 16
// members; 8 cylinders.
function patternSteppedPyramid(rng, m) {
  const hue       = rng();
  const baseCol   = hslToRgb(hue,        0.50, 0.55);
  const altCol    = hslToRgb(hue + 0.04, 0.55, 0.62);
  const accentCol = hslToRgb(hue + 0.5,  0.65, 0.62);
  const goldCol   = hslToRgb(0.13,       0.95, 0.55);

  const tiers = 6;
  const baseSize = 14;
  const tierH = 2.8 + rng() * 0.6;

  let stackZ = 0;
  for (let i = 0; i < tiers; i++) {
    const f = 1 - i / tiers;
    const size = baseSize * f * 0.95 + 1.2;
    setMember(m[i], false, GEOM_SLAB,
      0, 0,
      size, size, tierH,
      [0, 0, 0],
      i & 1 ? altCol : baseCol,
      /*dz=*/stackZ + tierH * 0.5);
    stackZ += tierH;
  }

  // 4 corner stairwell cylinders climbing up the lower half.
  const baseCorners = [[-5, -5], [5, -5], [-5, 5], [5, 5]];
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = baseCorners[i];
    setMember(m[6 + i], false, GEOM_CYLINDER, cx, cy, 0.8, 0.8, tiers * tierH * 0.6,
      [0, 0, 0], accentCol);
  }

  // Summit shrine — square box on top of the stack.
  setMember(m[10], false, GEOM_BOX, 0, 0, 2.6, 2.6, 2.6,
    [0, 0, 0], accentCol, /*dz=*/stackZ + 1.3);

  // Gold dome over the shrine.
  setMember(m[11], false, GEOM_DOME, 0, 0, 1.7, 1.7, 1.6,
    [0, 0, 0], goldCol, /*dz=*/stackZ + 2.6 + 0.5);

  // 4 summit altar cylinders at the corners of the shrine.
  const summitCorners = [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]];
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = summitCorners[i];
    setMember(m[12 + i], false, GEOM_CYLINDER, cx, cy, 0.3, 0.3, 1.6,
      [0, 0, 0], accentCol, /*dz=*/stackZ + 0.8);
  }
}

// ─── 8. Chemical Plant — fractionation forest ──────────────────────
// 6 fractionating columns (varied heights + varied colours) + 3 paired
// tanks (cyl + dome) + chimney + wide cooling tower + flare cylinder
// with flame cap. 16 members; 13 cylinders, 4 domes.
function patternChemicalPlant(rng, m) {
  const hue       = rng() * 0.10 + 0.55;
  const colA      = hslToRgb(hue,        0.50, 0.60);
  const colB      = hslToRgb(hue + 0.06, 0.55, 0.65);
  const colC      = hslToRgb(hue + 0.12, 0.50, 0.55);
  const tankColA  = hslToRgb(hue + 0.20, 0.55, 0.62);
  const tankColB  = hslToRgb(hue + 0.30, 0.55, 0.65);
  const tankColC  = hslToRgb(hue + 0.10, 0.60, 0.60);
  const flameCol  = hslToRgb(0.06, 0.95, 0.58);

  // 6 fractionating columns — varied heights and colours.
  const colSpec = [
    [colA, 22], [colB, 32], [colC, 18],
    [colA, 28], [colB, 24], [colC, 30]
  ];
  for (let i = 0; i < 6; i++) {
    const cx = (i % 3 - 1) * 3.2;
    const cy = -7 + Math.floor(i / 3) * 2.8;
    const [c, h] = colSpec[i];
    setMember(m[i], false, GEOM_CYLINDER,
      cx, cy,
      0.85, 0.85, h + rng() * 4,
      [0, 0, 0], c);
  }

  // 3 storage tank + dome cap pairs (6 members) along +X.
  const tankColors = [tankColA, tankColB, tankColC];
  for (let i = 0; i < 3; i++) {
    const tx = 7;
    const ty = -6 + i * 5;
    const tankH = 5 + rng() * 3;
    const tankR = 1.7;
    setMember(m[6 + i * 2],     false, GEOM_CYLINDER, tx, ty, tankR, tankR, tankH,
      [0, 0, 0], tankColors[i]);
    setMember(m[6 + i * 2 + 1], false, GEOM_DOME,     tx, ty, tankR * 1.05, tankR * 1.05, tankR * 1.4,
      [0, 0, 0], tankColors[i], /*dz=*/tankH + tankR * 0.3);
  }

  // Chimney.
  setMember(m[12], false, GEOM_CYLINDER, -7, 7, 0.95, 0.95, 26,
    [0, 0, 0], hslToRgb(hue, 0.40, 0.55));

  // Wide cooling tower.
  setMember(m[13], false, GEOM_CYLINDER, -10, 4, 2.6, 2.6, 14,
    [0, 0, 0], hslToRgb(hue + 0.02, 0.30, 0.70));

  // Flare cylinder + flame cap.
  setMember(m[14], false, GEOM_CYLINDER, -10, 8, 0.5, 0.5, 24,
    [0, 0, 0], hslToRgb(hue, 0.30, 0.50));
  setMember(m[15], false, GEOM_DOME, -10, 8, 0.85, 0.85, 1.6,
    [0, 0, 0], flameCol, /*dz=*/24.8);
}

// ─── 9. Construction Site — partial frame + cranes + scaffolding ────
// 4 floor slabs (in-progress floors), 4 corner scaffolding cylinders
// past the top floor, 4 building-edge lift columns, crane mast (cyl)
// + horizontal jib (cyl rotated 90°), counterweight, and a hanging
// hoist cable. 16 members; 10 cylinders.
function patternConstructionCrane(rng, m) {
  const hue         = rng();
  const frameCol    = hslToRgb(hue,        0.55, 0.60);
  const craneCol    = hslToRgb(0.13,       0.95, 0.55);  // construction-yellow
  const counterCol  = hslToRgb(0.05,       0.65, 0.50);
  const scaffoldCol = hslToRgb(0.13,       0.55, 0.65);
  const cableCol    = hslToRgb(0.0, 0.0, 0.30);

  // 4 floor slabs.
  for (let i = 0; i < 4; i++) {
    setMember(m[i], false, GEOM_SLAB, 0, 0, 7, 7, 0.4, [0, 0, 0], frameCol,
      /*dz=*/i * 3.5 + 0.2);
  }

  // 4 corner scaffolding cylinders standing past the top floor.
  const scaffoldCorners = [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]];
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = scaffoldCorners[i];
    setMember(m[4 + i], false, GEOM_CYLINDER, cx, cy, 0.20, 0.20, 18,
      [0, 0, 0], scaffoldCol, /*dz=*/9);
  }

  // Crane mast — tall cylinder.
  const mastH = 30;
  setMember(m[8], false, GEOM_CYLINDER, 4.8, 4.8, 0.65, 0.65, mastH,
    [0, 0, 0], craneCol);

  // Horizontal jib — cylinder laid down to point along world +X. The
  // cylinder is vertical by default (axis along +Z); rotating around
  // world Y by +π/2 sends its axis from +Z to +X.
  const jibLen = 14;
  setMember(m[9], false, GEOM_CYLINDER, 4.8 + jibLen / 2 - 4, 4.8,
    0.27, 0.27, jibLen,
    [0, Math.PI / 2, 0], craneCol,
    /*dz=*/mastH);

  // Counterweight box on the back of the jib.
  setMember(m[10], false, GEOM_BOX, 4.8 - 3, 4.8, 1.4, 1.4, 0.9,
    [0, 0, 0], counterCol, /*dz=*/mastH);

  // Hoist cable — thin vertical cylinder hanging from the jib.
  setMember(m[11], false, GEOM_CYLINDER, 4.8 + 6, 4.8, 0.07, 0.07, 12,
    [0, 0, 0], cableCol, /*dz=*/mastH - 6);

  // 4 building-edge lift cylinders.
  setMember(m[12], false, GEOM_CYLINDER, -4, 0, 0.4, 0.4, 16,
    [0, 0, 0], scaffoldCol, /*dz=*/8);
  setMember(m[13], false, GEOM_CYLINDER,  4, 0, 0.4, 0.4, 16,
    [0, 0, 0], scaffoldCol, /*dz=*/8);
  setMember(m[14], false, GEOM_CYLINDER,  0, -4, 0.4, 0.4, 16,
    [0, 0, 0], scaffoldCol, /*dz=*/8);
  setMember(m[15], false, GEOM_CYLINDER,  0,  4, 0.4, 0.4, 16,
    [0, 0, 0], scaffoldCol, /*dz=*/8);
}

// ─── 10. Colonnade Temple ───────────────────────────────────────────
// Greek-temple / Pantheon-inspired peristyle: a stepped platform, 12
// fluted columns wrapping a rectangular cella, a hemispherical dome
// roof, and a small cylindrical altar at the centre. Maxes out the
// group at 16 cylinder-heavy members.
function patternColonnadeTemple(rng, m) {
  const stoneHue = rng() * 0.08 + 0.06;
  const stoneCol  = hslToRgb(stoneHue,        0.40, 0.72);
  const cellaCol  = hslToRgb(stoneHue + 0.05, 0.55, 0.62);
  const roofCol   = hslToRgb(stoneHue + 0.10, 0.75, 0.55);
  const altarCol  = hslToRgb(stoneHue + 0.50, 0.65, 0.55);

  const platformW = 14;
  const platformD = 10;
  const platformH = 1.0;

  // Steps platform (low wide slab).
  setMember(m[0], false, GEOM_SLAB, 0, 0, platformW, platformD, platformH,
    [0, 0, 0], stoneCol);

  // 12 perimeter columns — 4 along each long edge, 2 along each short edge.
  // Columns sit on top of the platform.
  const colR = 0.55;
  const colH = 5.5;
  const colDz = platformH + colH * 0.5;
  const longSpan = platformW * 0.84;
  const shortSpan = platformD * 0.7;

  // Front row (south, -Y) — 4 cols.
  for (let i = 0; i < 4; i++) {
    const cx = (i / 3 - 0.5) * longSpan;
    setMember(m[1 + i], false, GEOM_CYLINDER, cx, -platformD * 0.42,
      colR, colR, colH, [0, 0, 0], stoneCol, /*dz=*/colDz);
  }
  // Back row (north, +Y) — 4 cols.
  for (let i = 0; i < 4; i++) {
    const cx = (i / 3 - 0.5) * longSpan;
    setMember(m[5 + i], false, GEOM_CYLINDER, cx, platformD * 0.42,
      colR, colR, colH, [0, 0, 0], stoneCol, /*dz=*/colDz);
  }
  // Side columns (2 per long-side, between front/back corners).
  for (let i = 0; i < 2; i++) {
    const cy = (i - 0.5) * shortSpan * 0.5;
    setMember(m[9 + i],  false, GEOM_CYLINDER, -longSpan * 0.5, cy,
      colR, colR, colH, [0, 0, 0], stoneCol, /*dz=*/colDz);
    setMember(m[11 + i], false, GEOM_CYLINDER,  longSpan * 0.5, cy,
      colR, colR, colH, [0, 0, 0], stoneCol, /*dz=*/colDz);
  }

  // Cella (rectangular sanctuary inside the colonnade).
  setMember(m[13], false, GEOM_BOX, 0, 0,
    longSpan * 0.55, shortSpan * 0.85, colH * 0.9,
    [0, 0, 0], cellaCol, /*dz=*/platformH + colH * 0.45);

  // Hemispherical dome on top of the cella.
  setMember(m[14], false, GEOM_DOME, 0, 0,
    shortSpan * 0.55, shortSpan * 0.55, shortSpan * 0.55,
    [0, 0, 0], roofCol,
    /*dz=*/platformH + colH * 0.9 + shortSpan * 0.1);

  // Small altar cylinder at the centre of the platform.
  setMember(m[15], false, GEOM_CYLINDER, 0, -platformD * 0.15,
    0.7, 0.7, 1.0, [0, 0, 0], altarCol,
    /*dz=*/platformH + 0.5);
}

// ─── 11. Power Plant — cooling towers, reactor dome, switchyard ─────
// 4 wide cooling-tower cylinders + a large reactor containment dome
// + tall chimney + transformer-yard cylinders + control building.
// 16 members; 11 cylinders.
function patternPowerPlant(rng, m) {
  const hue       = rng() * 0.10 + 0.55;
  const concrCol  = hslToRgb(hue,        0.35, 0.70);
  const concrCol2 = hslToRgb(hue + 0.04, 0.40, 0.60);
  const reactorCol = hslToRgb(hue + 0.02, 0.50, 0.55);
  const switchCol  = hslToRgb(hue + 0.50, 0.55, 0.55);
  const stackCol   = hslToRgb(hue,        0.30, 0.45);
  const ctrlCol    = hslToRgb(hue + 0.45, 0.55, 0.62);

  // 4 cooling towers — wide squat cylinders in a 2x2 grid, varied heights.
  const towerR = 2.6;
  const towerSpec = [
    [-7, -6,  16], [-1, -6,  19],
    [-7,  0,  18], [-1,  0,  15]
  ];
  for (let i = 0; i < 4; i++) {
    const [tx, ty, h] = towerSpec[i];
    setMember(m[i], false, GEOM_CYLINDER,
      tx, ty, towerR, towerR, h + rng() * 2,
      [0, 0, 0], i & 1 ? concrCol : concrCol2);
  }

  // Reactor containment building — short-but-massive cylinder with a
  // large hemispherical dome on top.
  const reactorR = 3.6, reactorH = 8;
  setMember(m[4], false, GEOM_CYLINDER, 7, -3, reactorR, reactorR, reactorH,
    [0, 0, 0], reactorCol);
  setMember(m[5], false, GEOM_DOME,     7, -3, reactorR * 1.05, reactorR * 1.05, reactorR * 1.0,
    [0, 0, 0], reactorCol, /*dz=*/reactorH + reactorR * 0.0);

  // Tall chimney with cap.
  setMember(m[6], false, GEOM_CYLINDER, 11, 5, 1.0, 1.0, 28,
    [0, 0, 0], stackCol);
  setMember(m[7], false, GEOM_DOME, 11, 5, 1.2, 1.2, 0.8,
    [0, 0, 0], hslToRgb(hue, 0.05, 0.30), /*dz=*/28.4);

  // Switchyard — 4 transformer cylinders in a row.
  for (let i = 0; i < 4; i++) {
    setMember(m[8 + i], false, GEOM_CYLINDER,
      -4 + i * 2.0, 7, 0.7, 0.7, 3.5 + rng() * 0.6,
      [0, 0, 0], switchCol);
  }

  // 4 high-tension pylons at the perimeter — slim tall cylinders.
  setMember(m[12], false, GEOM_CYLINDER,  -10, 8, 0.25, 0.25, 14,
    [0, 0, 0], hslToRgb(hue, 0.10, 0.55));
  setMember(m[13], false, GEOM_CYLINDER,   -3, 8, 0.25, 0.25, 14,
    [0, 0, 0], hslToRgb(hue, 0.10, 0.55));
  setMember(m[14], false, GEOM_CYLINDER,    4, 8, 0.25, 0.25, 14,
    [0, 0, 0], hslToRgb(hue, 0.10, 0.55));

  // Control building (slab).
  setMember(m[15], false, GEOM_SLAB, 0, -8.5, 4, 2.5, 3.5,
    [0, 0, 0], ctrlCol);
}

// ─── 12. Lighthouse Complex — striped tower + outbuildings ─────────
// Tall striped lighthouse tower (3 stacked cylinders alternating
// colours) + lamp dome + supporting cylinders + low base houses + a
// row of dock pilings (cylinders). 16 members; 12 cylinders.
function patternLighthouse(rng, m) {
  const hue = rng();
  const stripeWhite = hslToRgb(hue,        0.05, 0.85);
  const stripeRed   = hslToRgb(0.0,        0.85, 0.50);
  const lampCol     = hslToRgb(0.13,       0.95, 0.62);
  const houseCol    = hslToRgb(hue + 0.5,  0.55, 0.55);
  const houseRoofCol = hslToRgb(0.0,       0.65, 0.40);
  const pilingCol   = hslToRgb(hue,        0.20, 0.35);

  // Striped lighthouse tower — 5 alternating cylinder bands.
  const towerR = 1.4;
  const bandH = 4.5;
  for (let i = 0; i < 5; i++) {
    setMember(m[i], false, GEOM_CYLINDER,
      0, 0,
      towerR - i * 0.08, towerR - i * 0.08, bandH,
      [0, 0, 0],
      i & 1 ? stripeRed : stripeWhite,
      /*dz=*/bandH * 0.5 + i * bandH);
  }

  // Lamp room — wider cylinder at the top.
  setMember(m[5], false, GEOM_CYLINDER, 0, 0, 1.7, 1.7, 1.6,
    [0, 0, 0], hslToRgb(hue, 0.15, 0.30), /*dz=*/5 * bandH + 0.8);

  // Bright lamp dome on top.
  setMember(m[6], false, GEOM_DOME, 0, 0, 1.9, 1.9, 1.4,
    [0, 0, 0], lampCol, /*dz=*/5 * bandH + 1.6 + 0.7);

  // Lighthouse base / keeper's house — small slab + chimney.
  setMember(m[7], false, GEOM_SLAB, 4, -1, 4, 3, 3.0, [0, 0, 0], houseCol);
  setMember(m[8], false, GEOM_BOX,  4, -1, 4.2, 3.2, 1.4,    // peaked-look roof
    [0, 0, 0], houseRoofCol, /*dz=*/3.0 + 0.7);
  setMember(m[9], false, GEOM_CYLINDER, 5.4, -1, 0.25, 0.25, 1.4,
    [0, 0, 0], pilingCol, /*dz=*/3.0 + 1.4 + 0.7);

  // 6 dock pilings along -X — short cylinders rising out of the ground.
  for (let i = 0; i < 6; i++) {
    setMember(m[10 + i], false, GEOM_CYLINDER,
      -3 - i * 1.6, 6, 0.3, 0.3, 2.5,
      [0, 0, 0], pilingCol);
  }
}

// ─── 13. Train Station Hangar — long platform + canopy + clock ──────
// Long covered slab platform + 6 supporting cylinder columns + a
// taller clock tower + 2 platform-end gates + 3 light pylons.
// 16 members; 9 cylinders.
function patternTrainStation(rng, m) {
  const hue = rng();
  const canopyCol  = hslToRgb(hue,        0.45, 0.55);
  const supportCol = hslToRgb(hue + 0.05, 0.30, 0.70);
  const clockCol   = hslToRgb(hue + 0.50, 0.55, 0.60);
  const lampCol    = hslToRgb(0.13,       0.85, 0.62);
  const platformCol = hslToRgb(hue,       0.20, 0.40);

  // Long platform slab (thin, low).
  setMember(m[0], false, GEOM_SLAB, 0, 0, 22, 4, 0.6,
    [0, 0, 0], platformCol, /*dz=*/0.3);

  // Long canopy slab above the platform.
  setMember(m[1], false, GEOM_SLAB, 0, 0, 22, 4, 0.5,
    [0, 0, 0], canopyCol, /*dz=*/5.5);

  // 6 supporting cylinder columns under the canopy.
  for (let i = 0; i < 6; i++) {
    const cx = (i / 5 - 0.5) * 19;
    setMember(m[2 + i], false, GEOM_CYLINDER, cx, 0, 0.4, 0.4, 5,
      [0, 0, 0], supportCol);
  }

  // Clock tower at one end — tall cylinder with cap.
  setMember(m[8], false, GEOM_CYLINDER, 11.5, 0, 1.2, 1.2, 12,
    [0, 0, 0], clockCol);
  setMember(m[9], false, GEOM_DOME, 11.5, 0, 1.4, 1.4, 1.6,
    [0, 0, 0], hslToRgb(hue + 0.50, 0.65, 0.50), /*dz=*/12.0 + 0.8);

  // Clock face — small box on the upper portion of the tower.
  setMember(m[10], false, GEOM_BOX, 11.5, -1.3, 0.25, 1.0, 1.0,
    [0, 0, 0], hslToRgb(0.13, 0.55, 0.85), /*dz=*/9);

  // 2 platform-end gate boxes.
  setMember(m[11], false, GEOM_BOX, -11, 0, 1.5, 4.5, 4.0,
    [0, 0, 0], canopyCol);

  // 3 light pylons along the platform edge — slim tall cylinders.
  for (let i = 0; i < 3; i++) {
    const cx = (i - 1) * 7;
    setMember(m[12 + i], false, GEOM_CYLINDER, cx, 3, 0.18, 0.18, 7,
      [0, 0, 0], hslToRgb(hue, 0.10, 0.55));
  }

  // Lamp head atop the central pylon.
  setMember(m[15], false, GEOM_DOME, 0, 3, 0.5, 0.5, 0.4,
    [0, 0, 0], lampCol, /*dz=*/7.2);
}

// ─── 14. Tower + Podium (cameo) ─────────────────────────────────────
function patternTowerPodium(rng, m) {
  const hue = rng();
  const towerSx = 2.0 + rng() * 1.5;
  const towerSz = 14 + rng() * 16;
  const podiumSx = towerSx * 2.4;
  const podiumSz = 2.5 + rng() * 1.5;
  const rotZ = rng() * Math.PI * 2;
  setMember(m[0], false, GEOM_BOX,  0, 0, towerSx,  towerSx,  towerSz, [0, 0, rotZ],
    hslToRgb(hue, 0.7, 0.5));
  setMember(m[1], false, GEOM_SLAB, 0, 0, podiumSx, podiumSx, podiumSz, [0, 0, rotZ],
    hslToRgb(hue, 0.45, 0.55));
}

// ─── 15. Mixed Cluster (cameo) ──────────────────────────────────────
function patternMixedCluster(rng, m) {
  const base = hslToRgb(rng(), 0.55, 0.55);
  setMember(m[0], false, GEOM_BOX,      -3, -3, 1.6, 1.6, 8 + rng() * 16, [0,0,0], base);
  setMember(m[1], false, GEOM_CYLINDER,  3, -3, 1.4, 1.4, 5 + rng() * 9,  [0,0,0], base);
  setMember(m[2], false, GEOM_DOME,     -3,  3, 2.4, 2.4, 2.4 + rng(),    [0,0,0], base);
  setMember(m[3], false, GEOM_SLAB,      3,  3, 3.0, 3.0, 1.5 + rng(),    [0,0,0], base);
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

// Default `dz` is `sz * 0.5` so a unit-primitive sits with its bottom
// flush on the ground. Stacking patterns (dome on top of cylinder,
// pyramid tier on top of tier, etc.) pass an explicit `dz`.
//
// `rotation` is a 3-element Euler XYZ vector in radians. Pass [0,0,0]
// for the (very common) identity case.
function setMember(m, hidden, geomType, dx, dy, sx, sy, sz, rotation, color, dz) {
  m.hidden = hidden;
  m.geomType = geomType;
  m.dx = dx;
  m.dy = dy;
  m.dz = (dz !== undefined) ? dz : sz * 0.5;
  m.sx = sx;
  m.sy = sy;
  m.sz = sz;
  m.rotation[0] = rotation[0];
  m.rotation[1] = rotation[1];
  m.rotation[2] = rotation[2];
  m.color[0] = color[0];
  m.color[1] = color[1];
  m.color[2] = color[2];
}

// Tiny Mulberry32-style walker. Emits `[0, 1)` floats; quality is
// fine for visual variation.
function makeRng(tag) {
  let state = (tag | 0) ^ 0x9E3779B9;
  return function rng() {
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) % 0x100000) / 0x100000;
  };
}

// Used at init time to jitter group anchors. The runtime path uses
// `makeRng` instead so successive calls advance state.
function hash11(x) {
  const v = Math.sin(x * 91.117 + 12.9898) * 47453.5453;
  return v - Math.floor(v);
}

function hslToRgb(h, s, l) {
  h = h - Math.floor(h);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if      (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else             { r = c; b = x; }
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}
