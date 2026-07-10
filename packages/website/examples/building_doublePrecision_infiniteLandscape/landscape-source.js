const GEOM_BOX = 0;
const GEOM_SLAB = 1;
const GEOM_CYLINDER = 2;
const GEOM_DOME = 3;
const GROUP_SIZE = 16;
function createLandscapeSource({ slotCount = 1024, windowWidth = 280, windowHeight = 280, seed = 1 } = {}) {
    const groupCount = Math.ceil(slotCount / GROUP_SIZE);
    const totalSlots = groupCount * GROUP_SIZE;
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
    const out = new Array(totalSlots);
    for (let k = 0; k < totalSlots; k++) {
        out[k] = {
            slotId: k,
            hidden: true,
            geomType: 0,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            color: [1, 1, 1],
            opacity: 1
        };
    }
    const memberOut = new Array(GROUP_SIZE);
    for (let k = 0; k < GROUP_SIZE; k++) {
        memberOut[k] = {
            hidden: true,
            geomType: 0,
            dx: 0,
            dy: 0,
            dz: 0,
            sx: 1,
            sy: 1,
            sz: 1,
            rotation: [0, 0, 0],
            color: [1, 1, 1]
        };
    }
    function nextFrame(cameraX, cameraY) {
        for (let g2 = 0; g2 < groups.length; g2++) {
            const group = groups[g2];
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
                if (src.hidden)
                    continue;
                dst.geomType = src.geomType;
                dst.position[0] = ax + src.dx;
                dst.position[1] = ay + src.dy;
                dst.position[2] = src.dz;
                dst.rotation[0] = src.rotation[0];
                dst.rotation[1] = src.rotation[1];
                dst.rotation[2] = src.rotation[2];
                dst.scale[0] = src.sx;
                dst.scale[1] = src.sy;
                dst.scale[2] = src.sz;
                dst.color[0] = src.color[0];
                dst.color[1] = src.color[1];
                dst.color[2] = src.color[2];
                dst.opacity = 1;
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
const PATTERNS = [
    patternRefinery,
    patternCathedral,
    patternCastle,
    patternStadium,
    patternApartmentBalconies,
    patternSuspensionBridge,
    patternSteppedPyramid,
    patternChemicalPlant,
    patternConstructionCrane,
    patternColonnadeTemple,
    patternPowerPlant,
    patternLighthouse,
    patternTrainStation,
    patternTowerPodium,
    patternMixedCluster
];
const PATTERN_PICK_TABLE = [
    0,
    0,
    0,
    1,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    7,
    8,
    9,
    9,
    9,
    10,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    14
];
function applyPattern(rng, members) {
    for (let k = 0; k < members.length; k++)
        members[k].hidden = true;
    const pickIdx = Math.floor(rng() * PATTERN_PICK_TABLE.length) % PATTERN_PICK_TABLE.length;
    PATTERNS[PATTERN_PICK_TABLE[pickIdx]](rng, members);
}
function patternRefinery(rng, m) {
    const baseHue = rng() * 0.1 + 0.55;
    const colA = hslToRgb(baseHue + 0.02, 0.5, 0.6);
    const colB = hslToRgb(baseHue + 0.08, 0.55, 0.65);
    const colC = hslToRgb(baseHue + 0.14, 0.45, 0.55);
    const tankColA = hslToRgb(baseHue + 0.2, 0.5, 0.62);
    const tankColB = hslToRgb(baseHue + 0.05, 0.55, 0.66);
    const tankColC = hslToRgb(baseHue + 0.3, 0.5, 0.6);
    const officeCol = hslToRgb(baseHue + 0.5, 0.65, 0.55);
    const flareCol = hslToRgb(0.06, 0.95, 0.55);
    const colSpec = [
        [colA, 24, 0.95],
        [colB, 34, 1.1],
        [colC, 20, 0.85],
        [colA, 30, 1]
    ];
    for (let i = 0; i < 4; i++) {
        const [c, h, r] = colSpec[i];
        setMember(m[i], false, GEOM_CYLINDER, -11 + i * 2.4, -7, r, r, h + rng() * 3, [0, 0, 0], c);
    }
    const tankPos = [[5, -8], [10, -3], [5, 3]];
    const tankCols = [tankColA, tankColB, tankColC];
    for (let i = 0; i < 3; i++) {
        const [tx, ty] = tankPos[i];
        const tankH = 5 + rng() * 4;
        const tankR = 2 + rng() * 0.5;
        setMember(m[4 + i * 2], false, GEOM_CYLINDER, tx, ty, tankR, tankR, tankH, [0, 0, 0], tankCols[i]);
        setMember(m[4 + i * 2 + 1], false, GEOM_DOME, tx, ty, tankR * 1.05, tankR * 1.05, tankR * 1.4, [0, 0, 0], tankCols[i], tankH + tankR * 0.3);
    }
    setMember(m[10], false, GEOM_CYLINDER, 11, 8, 2.6, 2.6, 16, [0, 0, 0], hslToRgb(baseHue + 0.02, 0.35, 0.7));
    setMember(m[11], false, GEOM_CYLINDER, -11, 8, 0.5, 0.5, 32, [0, 0, 0], hslToRgb(baseHue, 0.3, 0.5));
    setMember(m[12], false, GEOM_DOME, -11, 8, 0.9, 0.9, 1.8, [0, 0, 0], flareCol, 32.9);
    setMember(m[13], false, GEOM_CYLINDER, -5, 7, 0.95, 0.95, 22, [0, 0, 0], hslToRgb(baseHue + 0.04, 0.4, 0.55));
    setMember(m[14], false, GEOM_CYLINDER, 0, 0, 0.45, 0.45, 12, [0, 0, 0], colC);
    setMember(m[15], false, GEOM_SLAB, 0, 9, 5, 3, 4.5, [0, 0, 0], officeCol);
}
function patternCathedral(rng, m) {
    const stoneHue = rng() * 0.08 + 0.07;
    const stoneCol = hslToRgb(stoneHue, 0.4, 0.68);
    const stoneCol2 = hslToRgb(stoneHue + 0.03, 0.45, 0.74);
    const roofCol = hslToRgb(stoneHue + 0.55, 0.85, 0.45);
    const goldCol = hslToRgb(0.13, 0.95, 0.58);
    const naveLen = 14, naveW = 4, naveH = 9;
    setMember(m[0], false, GEOM_SLAB, 0, 0, naveW, naveLen, naveH, [0, 0, 0], stoneCol);
    setMember(m[1], false, GEOM_SLAB, 6, 0, 7, naveW, naveH, [0, 0, 0], stoneCol);
    setMember(m[2], false, GEOM_SLAB, -6, 0, 7, naveW, naveH, [0, 0, 0], stoneCol);
    setMember(m[3], false, GEOM_CYLINDER, 0, 0, 1.3, 1.3, 22, [0, 0, 0], stoneCol2, naveH + 11);
    setMember(m[4], false, GEOM_DOME, 0, 0, 1.7, 1.7, 6, [0, 0, 0], goldCol, naveH + 22 + 3);
    for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1;
        const yi = i % 3;
        setMember(m[5 + i], false, GEOM_CYLINDER, side * (naveW * 0.5 + 1.4), (yi - 1) * (naveLen * 0.3), 0.55, 0.55, naveH + 1, [0, 0, 0], stoneCol);
    }
    setMember(m[11], false, GEOM_CYLINDER, -3.2, -8.5, 1.7, 1.7, 14, [0, 0, 0], stoneCol2);
    setMember(m[12], false, GEOM_DOME, -3.2, -8.5, 2.1, 2.1, 2.6, [0, 0, 0], roofCol, 14 + 0.8);
    setMember(m[13], false, GEOM_CYLINDER, 3.2, -8.5, 1.7, 1.7, 14, [0, 0, 0], stoneCol2);
    setMember(m[14], false, GEOM_DOME, 3.2, -8.5, 2.1, 2.1, 2.6, [0, 0, 0], roofCol, 14 + 0.8);
    setMember(m[15], false, GEOM_DOME, 0, 9, 4, 4, 4.8, [0, 0, 0], roofCol);
}
function patternCastle(rng, m) {
    const stoneHue = rng() * 0.08;
    const stoneCol = hslToRgb(stoneHue, 0.35, 0.62);
    const stoneCol2 = hslToRgb(stoneHue + 0.04, 0.45, 0.66);
    const roofCol = hslToRgb(0, 0.85, 0.42);
    setMember(m[0], false, GEOM_CYLINDER, 0, 0, 3, 3, 18, [0, 0, 0], stoneCol2);
    setMember(m[1], false, GEOM_DOME, 0, 0, 3.5, 3.5, 5, [0, 0, 0], roofCol, 18 + 1.4);
    const corners = [[-7, -7], [7, -7], [-7, 7], [7, 7]];
    for (let i = 0; i < 4; i++) {
        const [cx, cy] = corners[i];
        const towerH = 12 + rng() * 1.5;
        const towerR = 1.5;
        setMember(m[2 + i * 2], false, GEOM_CYLINDER, cx, cy, towerR, towerR, towerH, [0, 0, 0], stoneCol);
        setMember(m[3 + i * 2], false, GEOM_DOME, cx, cy, towerR * 1.5, towerR * 1.5, towerR * 2, [0, 0, 0], roofCol, towerH + towerR * 0.7);
    }
    setMember(m[10], false, GEOM_SLAB, 0, -7, 11, 1, 4.5, [0, 0, 0], stoneCol);
    setMember(m[11], false, GEOM_SLAB, 0, 7, 11, 1, 4.5, [0, 0, 0], stoneCol);
    setMember(m[12], false, GEOM_SLAB, -7, 0, 1, 11, 4.5, [0, 0, 0], stoneCol);
    setMember(m[13], false, GEOM_SLAB, 7, 0, 1, 11, 4.5, [0, 0, 0], stoneCol);
    setMember(m[14], false, GEOM_CYLINDER, -2.5, -7.5, 1, 1, 9, [0, 0, 0], stoneCol2);
    setMember(m[15], false, GEOM_CYLINDER, 2.5, -7.5, 1, 1, 9, [0, 0, 0], stoneCol2);
}
function patternStadium(rng, m) {
    const hue = rng();
    const standCol = hslToRgb(hue, 0.6, 0.6);
    const standCol2 = hslToRgb(hue + 0.08, 0.55, 0.65);
    const plazaCol = hslToRgb(hue + 0.5, 0.45, 0.55);
    const lightCol = hslToRgb(hue + 0.1, 0.3, 0.78);
    const lightHeadCol = hslToRgb(0.13, 0.95, 0.65);
    const segments = 8, radius = 9;
    for (let i = 0; i < segments; i++) {
        const ang = i / segments * Math.PI * 2;
        setMember(m[i], false, GEOM_SLAB, Math.cos(ang) * radius, Math.sin(ang) * radius, 6, 2.5, 5 + rng() * 1.5, [0, 0, ang + Math.PI / 2], i & 1 ? standCol : standCol2);
    }
    const lightR = 12;
    for (let i = 0; i < 4; i++) {
        const ang = i / 4 * Math.PI * 2 + Math.PI / 4;
        const lx = Math.cos(ang) * lightR;
        const ly = Math.sin(ang) * lightR;
        setMember(m[8 + i * 2], false, GEOM_CYLINDER, lx, ly, 0.4, 0.4, 20, [0, 0, 0], lightCol);
        setMember(m[9 + i * 2], false, GEOM_DOME, lx, ly, 0.9, 0.9, 0.6, [0, 0, 0], lightHeadCol, 20 + 0.25);
    }
}
function patternApartmentBalconies(rng, m) {
    const hue = rng();
    const towerCol = hslToRgb(hue, 0.5, 0.55);
    const balconyCol = hslToRgb(hue, 0.7, 0.7);
    const balconyAlt = hslToRgb(hue + 0.08, 0.7, 0.65);
    const shaftCol = hslToRgb(hue + 0.05, 0.45, 0.45);
    const helipadCol = hslToRgb(hue + 0.5, 0.85, 0.55);
    const towerH = 38 + rng() * 8;
    setMember(m[0], false, GEOM_BOX, 0, 0, 4.5, 4.5, towerH, [0, 0, 0], towerCol);
    const corners = [[-3, -3], [3, -3], [-3, 3], [3, 3]];
    for (let i = 0; i < 4; i++) {
        const [cx, cy] = corners[i];
        setMember(m[1 + i], false, GEOM_CYLINDER, cx, cy, 0.7, 0.7, towerH * 0.92, [0, 0, 0], shaftCol);
    }
    for (let i = 0; i < 8; i++) {
        const side = i % 4;
        const tier = Math.floor(i / 4);
        const ang = side * Math.PI / 2;
        const balconyZ = 9 + tier * (towerH - 18);
        setMember(m[5 + i], false, GEOM_SLAB, Math.cos(ang) * 3.6, Math.sin(ang) * 3.6, 3, 1.6, 1.2, [0, 0, ang], i & 1 ? balconyCol : balconyAlt, balconyZ);
    }
    setMember(m[13], false, GEOM_CYLINDER, 0, 0, 0.18, 0.18, 8, [0, 0, 0], helipadCol, towerH + 4);
    setMember(m[14], false, GEOM_DOME, 0, 0, 2.8, 2.8, 1, [0, 0, 0], helipadCol, towerH + 0.6);
    setMember(m[15], false, GEOM_SLAB, 0, -4.5, 6, 2, 1.4, [0, 0, 0], balconyCol, 0.9);
}
function patternSuspensionBridge(rng, m) {
    const hue = rng() * 0.1 + 0.55;
    const pylonCol = hslToRgb(hue, 0.6, 0.55);
    const deckCol = hslToRgb(hue, 0.5, 0.5);
    const cableCol = hslToRgb(hue, 0.3, 0.78);
    const pierCol = hslToRgb(hue + 0.05, 0.4, 0.45);
    const pylonX = 9, pylonH = 28, deckZ = 8;
    setMember(m[0], false, GEOM_CYLINDER, -pylonX, -1, 1.2, 1.2, pylonH, [0, 0, 0], pylonCol);
    setMember(m[1], false, GEOM_CYLINDER, -pylonX, 1, 1.2, 1.2, pylonH, [0, 0, 0], pylonCol);
    setMember(m[2], false, GEOM_CYLINDER, pylonX, -1, 1.2, 1.2, pylonH, [0, 0, 0], pylonCol);
    setMember(m[3], false, GEOM_CYLINDER, pylonX, 1, 1.2, 1.2, pylonH, [0, 0, 0], pylonCol);
    setMember(m[4], false, GEOM_SLAB, 0, 0, pylonX * 2 + 4, 5, 0.6, [0, 0, 0], deckCol, deckZ);
    for (let p = 0; p < 2; p++) {
        const px = (p === 0 ? -1 : 1) * pylonX;
        const sign = p === 0 ? 1 : -1;
        for (let c = 0; c < 4; c++) {
            const deckOff = (c + 1) * 1.7;
            const deckXAbs = px + sign * deckOff;
            const dx = deckXAbs - px;
            const dzSpan = pylonH - deckZ;
            const cableLen = Math.hypot(dx, dzSpan);
            const tilt = Math.atan2(dx, dzSpan);
            setMember(m[5 + p * 4 + c], false, GEOM_CYLINDER, (px + deckXAbs) / 2, 0, 0.1, 0.1, cableLen, [0, tilt, 0], cableCol, (pylonH + deckZ) / 2);
        }
    }
    for (let i = 0; i < 3; i++) {
        setMember(m[13 + i], false, GEOM_CYLINDER, (i - 1) * 4, 0, 0.7, 0.7, deckZ, [0, 0, 0], pierCol);
    }
}
function patternSteppedPyramid(rng, m) {
    const hue = rng();
    const baseCol = hslToRgb(hue, 0.5, 0.55);
    const altCol = hslToRgb(hue + 0.04, 0.55, 0.62);
    const accentCol = hslToRgb(hue + 0.5, 0.65, 0.62);
    const goldCol = hslToRgb(0.13, 0.95, 0.55);
    const tiers = 6;
    const baseSize = 14;
    const tierH = 2.8 + rng() * 0.6;
    let stackZ = 0;
    for (let i = 0; i < tiers; i++) {
        const f = 1 - i / tiers;
        const size = baseSize * f * 0.95 + 1.2;
        setMember(m[i], false, GEOM_SLAB, 0, 0, size, size, tierH, [0, 0, 0], i & 1 ? altCol : baseCol, stackZ + tierH * 0.5);
        stackZ += tierH;
    }
    const baseCorners = [[-5, -5], [5, -5], [-5, 5], [5, 5]];
    for (let i = 0; i < 4; i++) {
        const [cx, cy] = baseCorners[i];
        setMember(m[6 + i], false, GEOM_CYLINDER, cx, cy, 0.8, 0.8, tiers * tierH * 0.6, [0, 0, 0], accentCol);
    }
    setMember(m[10], false, GEOM_BOX, 0, 0, 2.6, 2.6, 2.6, [0, 0, 0], accentCol, stackZ + 1.3);
    setMember(m[11], false, GEOM_DOME, 0, 0, 1.7, 1.7, 1.6, [0, 0, 0], goldCol, stackZ + 2.6 + 0.5);
    const summitCorners = [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]];
    for (let i = 0; i < 4; i++) {
        const [cx, cy] = summitCorners[i];
        setMember(m[12 + i], false, GEOM_CYLINDER, cx, cy, 0.3, 0.3, 1.6, [0, 0, 0], accentCol, stackZ + 0.8);
    }
}
function patternChemicalPlant(rng, m) {
    const hue = rng() * 0.1 + 0.55;
    const colA = hslToRgb(hue, 0.5, 0.6);
    const colB = hslToRgb(hue + 0.06, 0.55, 0.65);
    const colC = hslToRgb(hue + 0.12, 0.5, 0.55);
    const tankColA = hslToRgb(hue + 0.2, 0.55, 0.62);
    const tankColB = hslToRgb(hue + 0.3, 0.55, 0.65);
    const tankColC = hslToRgb(hue + 0.1, 0.6, 0.6);
    const flameCol = hslToRgb(0.06, 0.95, 0.58);
    const colSpec = [
        [colA, 22],
        [colB, 32],
        [colC, 18],
        [colA, 28],
        [colB, 24],
        [colC, 30]
    ];
    for (let i = 0; i < 6; i++) {
        const cx = (i % 3 - 1) * 3.2;
        const cy = -7 + Math.floor(i / 3) * 2.8;
        const [c, h] = colSpec[i];
        setMember(m[i], false, GEOM_CYLINDER, cx, cy, 0.85, 0.85, h + rng() * 4, [0, 0, 0], c);
    }
    const tankColors = [tankColA, tankColB, tankColC];
    for (let i = 0; i < 3; i++) {
        const tx = 7;
        const ty = -6 + i * 5;
        const tankH = 5 + rng() * 3;
        const tankR = 1.7;
        setMember(m[6 + i * 2], false, GEOM_CYLINDER, tx, ty, tankR, tankR, tankH, [0, 0, 0], tankColors[i]);
        setMember(m[6 + i * 2 + 1], false, GEOM_DOME, tx, ty, tankR * 1.05, tankR * 1.05, tankR * 1.4, [0, 0, 0], tankColors[i], tankH + tankR * 0.3);
    }
    setMember(m[12], false, GEOM_CYLINDER, -7, 7, 0.95, 0.95, 26, [0, 0, 0], hslToRgb(hue, 0.4, 0.55));
    setMember(m[13], false, GEOM_CYLINDER, -10, 4, 2.6, 2.6, 14, [0, 0, 0], hslToRgb(hue + 0.02, 0.3, 0.7));
    setMember(m[14], false, GEOM_CYLINDER, -10, 8, 0.5, 0.5, 24, [0, 0, 0], hslToRgb(hue, 0.3, 0.5));
    setMember(m[15], false, GEOM_DOME, -10, 8, 0.85, 0.85, 1.6, [0, 0, 0], flameCol, 24.8);
}
function patternConstructionCrane(rng, m) {
    const hue = rng();
    const frameCol = hslToRgb(hue, 0.55, 0.6);
    const craneCol = hslToRgb(0.13, 0.95, 0.55);
    const counterCol = hslToRgb(0.05, 0.65, 0.5);
    const scaffoldCol = hslToRgb(0.13, 0.55, 0.65);
    const cableCol = hslToRgb(0, 0, 0.3);
    for (let i = 0; i < 4; i++) {
        setMember(m[i], false, GEOM_SLAB, 0, 0, 7, 7, 0.4, [0, 0, 0], frameCol, i * 3.5 + 0.2);
    }
    const scaffoldCorners = [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]];
    for (let i = 0; i < 4; i++) {
        const [cx, cy] = scaffoldCorners[i];
        setMember(m[4 + i], false, GEOM_CYLINDER, cx, cy, 0.2, 0.2, 18, [0, 0, 0], scaffoldCol, 9);
    }
    const mastH = 30;
    setMember(m[8], false, GEOM_CYLINDER, 4.8, 4.8, 0.65, 0.65, mastH, [0, 0, 0], craneCol);
    const jibLen = 14;
    setMember(m[9], false, GEOM_CYLINDER, 4.8 + jibLen / 2 - 4, 4.8, 0.27, 0.27, jibLen, [0, Math.PI / 2, 0], craneCol, mastH);
    setMember(m[10], false, GEOM_BOX, 4.8 - 3, 4.8, 1.4, 1.4, 0.9, [0, 0, 0], counterCol, mastH);
    setMember(m[11], false, GEOM_CYLINDER, 4.8 + 6, 4.8, 0.07, 0.07, 12, [0, 0, 0], cableCol, mastH - 6);
    setMember(m[12], false, GEOM_CYLINDER, -4, 0, 0.4, 0.4, 16, [0, 0, 0], scaffoldCol, 8);
    setMember(m[13], false, GEOM_CYLINDER, 4, 0, 0.4, 0.4, 16, [0, 0, 0], scaffoldCol, 8);
    setMember(m[14], false, GEOM_CYLINDER, 0, -4, 0.4, 0.4, 16, [0, 0, 0], scaffoldCol, 8);
    setMember(m[15], false, GEOM_CYLINDER, 0, 4, 0.4, 0.4, 16, [0, 0, 0], scaffoldCol, 8);
}
function patternColonnadeTemple(rng, m) {
    const stoneHue = rng() * 0.08 + 0.06;
    const stoneCol = hslToRgb(stoneHue, 0.4, 0.72);
    const cellaCol = hslToRgb(stoneHue + 0.05, 0.55, 0.62);
    const roofCol = hslToRgb(stoneHue + 0.1, 0.75, 0.55);
    const altarCol = hslToRgb(stoneHue + 0.5, 0.65, 0.55);
    const platformW = 14;
    const platformD = 10;
    const platformH = 1;
    setMember(m[0], false, GEOM_SLAB, 0, 0, platformW, platformD, platformH, [0, 0, 0], stoneCol);
    const colR = 0.55;
    const colH = 5.5;
    const colDz = platformH + colH * 0.5;
    const longSpan = platformW * 0.84;
    const shortSpan = platformD * 0.7;
    for (let i = 0; i < 4; i++) {
        const cx = (i / 3 - 0.5) * longSpan;
        setMember(m[1 + i], false, GEOM_CYLINDER, cx, -platformD * 0.42, colR, colR, colH, [0, 0, 0], stoneCol, colDz);
    }
    for (let i = 0; i < 4; i++) {
        const cx = (i / 3 - 0.5) * longSpan;
        setMember(m[5 + i], false, GEOM_CYLINDER, cx, platformD * 0.42, colR, colR, colH, [0, 0, 0], stoneCol, colDz);
    }
    for (let i = 0; i < 2; i++) {
        const cy = (i - 0.5) * shortSpan * 0.5;
        setMember(m[9 + i], false, GEOM_CYLINDER, -longSpan * 0.5, cy, colR, colR, colH, [0, 0, 0], stoneCol, colDz);
        setMember(m[11 + i], false, GEOM_CYLINDER, longSpan * 0.5, cy, colR, colR, colH, [0, 0, 0], stoneCol, colDz);
    }
    setMember(m[13], false, GEOM_BOX, 0, 0, longSpan * 0.55, shortSpan * 0.85, colH * 0.9, [0, 0, 0], cellaCol, platformH + colH * 0.45);
    setMember(m[14], false, GEOM_DOME, 0, 0, shortSpan * 0.55, shortSpan * 0.55, shortSpan * 0.55, [0, 0, 0], roofCol, platformH + colH * 0.9 + shortSpan * 0.1);
    setMember(m[15], false, GEOM_CYLINDER, 0, -platformD * 0.15, 0.7, 0.7, 1, [0, 0, 0], altarCol, platformH + 0.5);
}
function patternPowerPlant(rng, m) {
    const hue = rng() * 0.1 + 0.55;
    const concrCol = hslToRgb(hue, 0.35, 0.7);
    const concrCol2 = hslToRgb(hue + 0.04, 0.4, 0.6);
    const reactorCol = hslToRgb(hue + 0.02, 0.5, 0.55);
    const switchCol = hslToRgb(hue + 0.5, 0.55, 0.55);
    const stackCol = hslToRgb(hue, 0.3, 0.45);
    const ctrlCol = hslToRgb(hue + 0.45, 0.55, 0.62);
    const towerR = 2.6;
    const towerSpec = [
        [-7, -6, 16],
        [-1, -6, 19],
        [-7, 0, 18],
        [-1, 0, 15]
    ];
    for (let i = 0; i < 4; i++) {
        const [tx, ty, h] = towerSpec[i];
        setMember(m[i], false, GEOM_CYLINDER, tx, ty, towerR, towerR, h + rng() * 2, [0, 0, 0], i & 1 ? concrCol : concrCol2);
    }
    const reactorR = 3.6, reactorH = 8;
    setMember(m[4], false, GEOM_CYLINDER, 7, -3, reactorR, reactorR, reactorH, [0, 0, 0], reactorCol);
    setMember(m[5], false, GEOM_DOME, 7, -3, reactorR * 1.05, reactorR * 1.05, reactorR * 1, [0, 0, 0], reactorCol, reactorH + reactorR * 0);
    setMember(m[6], false, GEOM_CYLINDER, 11, 5, 1, 1, 28, [0, 0, 0], stackCol);
    setMember(m[7], false, GEOM_DOME, 11, 5, 1.2, 1.2, 0.8, [0, 0, 0], hslToRgb(hue, 0.05, 0.3), 28.4);
    for (let i = 0; i < 4; i++) {
        setMember(m[8 + i], false, GEOM_CYLINDER, -4 + i * 2, 7, 0.7, 0.7, 3.5 + rng() * 0.6, [0, 0, 0], switchCol);
    }
    setMember(m[12], false, GEOM_CYLINDER, -10, 8, 0.25, 0.25, 14, [0, 0, 0], hslToRgb(hue, 0.1, 0.55));
    setMember(m[13], false, GEOM_CYLINDER, -3, 8, 0.25, 0.25, 14, [0, 0, 0], hslToRgb(hue, 0.1, 0.55));
    setMember(m[14], false, GEOM_CYLINDER, 4, 8, 0.25, 0.25, 14, [0, 0, 0], hslToRgb(hue, 0.1, 0.55));
    setMember(m[15], false, GEOM_SLAB, 0, -8.5, 4, 2.5, 3.5, [0, 0, 0], ctrlCol);
}
function patternLighthouse(rng, m) {
    const hue = rng();
    const stripeWhite = hslToRgb(hue, 0.05, 0.85);
    const stripeRed = hslToRgb(0, 0.85, 0.5);
    const lampCol = hslToRgb(0.13, 0.95, 0.62);
    const houseCol = hslToRgb(hue + 0.5, 0.55, 0.55);
    const houseRoofCol = hslToRgb(0, 0.65, 0.4);
    const pilingCol = hslToRgb(hue, 0.2, 0.35);
    const towerR = 1.4;
    const bandH = 4.5;
    for (let i = 0; i < 5; i++) {
        setMember(m[i], false, GEOM_CYLINDER, 0, 0, towerR - i * 0.08, towerR - i * 0.08, bandH, [0, 0, 0], i & 1 ? stripeRed : stripeWhite, bandH * 0.5 + i * bandH);
    }
    setMember(m[5], false, GEOM_CYLINDER, 0, 0, 1.7, 1.7, 1.6, [0, 0, 0], hslToRgb(hue, 0.15, 0.3), 5 * bandH + 0.8);
    setMember(m[6], false, GEOM_DOME, 0, 0, 1.9, 1.9, 1.4, [0, 0, 0], lampCol, 5 * bandH + 1.6 + 0.7);
    setMember(m[7], false, GEOM_SLAB, 4, -1, 4, 3, 3, [0, 0, 0], houseCol);
    setMember(m[8], false, GEOM_BOX, 4, -1, 4.2, 3.2, 1.4, [0, 0, 0], houseRoofCol, 3 + 0.7);
    setMember(m[9], false, GEOM_CYLINDER, 5.4, -1, 0.25, 0.25, 1.4, [0, 0, 0], pilingCol, 3 + 1.4 + 0.7);
    for (let i = 0; i < 6; i++) {
        setMember(m[10 + i], false, GEOM_CYLINDER, -3 - i * 1.6, 6, 0.3, 0.3, 2.5, [0, 0, 0], pilingCol);
    }
}
function patternTrainStation(rng, m) {
    const hue = rng();
    const canopyCol = hslToRgb(hue, 0.45, 0.55);
    const supportCol = hslToRgb(hue + 0.05, 0.3, 0.7);
    const clockCol = hslToRgb(hue + 0.5, 0.55, 0.6);
    const lampCol = hslToRgb(0.13, 0.85, 0.62);
    const platformCol = hslToRgb(hue, 0.2, 0.4);
    setMember(m[0], false, GEOM_SLAB, 0, 0, 22, 4, 0.6, [0, 0, 0], platformCol, 0.3);
    setMember(m[1], false, GEOM_SLAB, 0, 0, 22, 4, 0.5, [0, 0, 0], canopyCol, 5.5);
    for (let i = 0; i < 6; i++) {
        const cx = (i / 5 - 0.5) * 19;
        setMember(m[2 + i], false, GEOM_CYLINDER, cx, 0, 0.4, 0.4, 5, [0, 0, 0], supportCol);
    }
    setMember(m[8], false, GEOM_CYLINDER, 11.5, 0, 1.2, 1.2, 12, [0, 0, 0], clockCol);
    setMember(m[9], false, GEOM_DOME, 11.5, 0, 1.4, 1.4, 1.6, [0, 0, 0], hslToRgb(hue + 0.5, 0.65, 0.5), 12 + 0.8);
    setMember(m[10], false, GEOM_BOX, 11.5, -1.3, 0.25, 1, 1, [0, 0, 0], hslToRgb(0.13, 0.55, 0.85), 9);
    setMember(m[11], false, GEOM_BOX, -11, 0, 1.5, 4.5, 4, [0, 0, 0], canopyCol);
    for (let i = 0; i < 3; i++) {
        const cx = (i - 1) * 7;
        setMember(m[12 + i], false, GEOM_CYLINDER, cx, 3, 0.18, 0.18, 7, [0, 0, 0], hslToRgb(hue, 0.1, 0.55));
    }
    setMember(m[15], false, GEOM_DOME, 0, 3, 0.5, 0.5, 0.4, [0, 0, 0], lampCol, 7.2);
}
function patternTowerPodium(rng, m) {
    const hue = rng();
    const towerSx = 2 + rng() * 1.5;
    const towerSz = 14 + rng() * 16;
    const podiumSx = towerSx * 2.4;
    const podiumSz = 2.5 + rng() * 1.5;
    const rotZ = rng() * Math.PI * 2;
    setMember(m[0], false, GEOM_BOX, 0, 0, towerSx, towerSx, towerSz, [0, 0, rotZ], hslToRgb(hue, 0.7, 0.5));
    setMember(m[1], false, GEOM_SLAB, 0, 0, podiumSx, podiumSx, podiumSz, [0, 0, rotZ], hslToRgb(hue, 0.45, 0.55));
}
function patternMixedCluster(rng, m) {
    const base = hslToRgb(rng(), 0.55, 0.55);
    setMember(m[0], false, GEOM_BOX, -3, -3, 1.6, 1.6, 8 + rng() * 16, [0, 0, 0], base);
    setMember(m[1], false, GEOM_CYLINDER, 3, -3, 1.4, 1.4, 5 + rng() * 9, [0, 0, 0], base);
    setMember(m[2], false, GEOM_DOME, -3, 3, 2.4, 2.4, 2.4 + rng(), [0, 0, 0], base);
    setMember(m[3], false, GEOM_SLAB, 3, 3, 3, 3, 1.5 + rng(), [0, 0, 0], base);
}
function setMember(m, hidden, geomType, dx, dy, sx, sy, sz, rotation, color, dz) {
    m.hidden = hidden;
    m.geomType = geomType;
    m.dx = dx;
    m.dy = dy;
    m.dz = dz !== void 0 ? dz : sz * 0.5;
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
function makeRng(tag) {
    let state = (tag | 0) ^ 2654435769;
    return function rng() {
        state = state + 1831565813 | 0;
        let t = state;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) % 1048576 / 1048576;
    };
}
function hash11(x) {
    const v = Math.sin(x * 91.117 + 12.9898) * 47453.5453;
    return v - Math.floor(v);
}
function hslToRgb(h, s, l) {
    h = h - Math.floor(h);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h * 6;
    const x = c * (1 - Math.abs(hp % 2 - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) {
        r = c;
        g = x;
    }
    else if (hp < 2) {
        r = x;
        g = c;
    }
    else if (hp < 3) {
        g = c;
        b = x;
    }
    else if (hp < 4) {
        g = x;
        b = c;
    }
    else if (hp < 5) {
        r = x;
        b = c;
    }
    else {
        r = c;
        b = x;
    }
    const m = l - c / 2;
    return [r + m, g + m, b + m];
}
export { GEOM_BOX, GEOM_CYLINDER, GEOM_DOME, GEOM_SLAB, createLandscapeSource };
