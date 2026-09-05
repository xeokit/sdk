import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";
const { newPixelBuffer, heightToNormal, flatMR, periodicHash2, periodicNoise2, periodicFbm, clamp01 } = xeokit.model.generation.paintMaterials;
function paintStoneBlock(size, options = {}) {
    const COLS = options.cols ?? 3;
    const ROWS = options.rows ?? 5;
    const cellW = size / COLS, cellH = size / ROWS;
    const mortar = (options.mortar ?? 0.1) * cellH;
    const bevel = options.bevel ?? 0.22;
    const baseColor = options.color ?? [0.62, 0.6, 0.55];
    const mortarColor = options.mortarColor ?? [0.3, 0.3, 0.28];
    const normalStrength = options.normalStrength ?? 3.5;
    const roughness = options.roughness ?? 0.9;
    const blockNoise = options.blockNoise ?? 0.08;
    const hgt = newPixelBuffer(size);
    const hd = hgt.data;
    for (let y = 0; y < size; y++) {
        const row = Math.floor(y / cellH);
        const yInCell = y - row * cellH;
        const stagger = row % 2 * (cellW * 0.5);
        for (let x = 0; x < size; x++) {
            const xs = (x + stagger) % size;
            const col = Math.floor(xs / cellW);
            const xInCell = xs - col * cellW;
            const fx = Math.min(xInCell, cellW - xInCell) / cellW;
            const fy = Math.min(yInCell, cellH - yInCell) / cellH;
            const inMortarX = xInCell < mortar || xInCell > cellW - mortar;
            const inMortarY = yInCell < mortar || yInCell > cellH - mortar;
            let h;
            if (inMortarX || inMortarY) {
                h = 0.1 + 0.05 * periodicHash2(x, y, size, size);
            }
            else {
                const e = Math.min(fx, fy);
                const bump = (periodicNoise2(x * 0.08, y * 0.08, size * 0.08, size * 0.08) - 0.5) * 0.12;
                h = clamp01(0.55 + Math.min(1, e / bevel) * 0.4 + bump);
            }
            const i = (y * size + x) * 4;
            const v = Math.round(h * 255);
            hd[i] = hd[i + 1] = hd[i + 2] = v;
            hd[i + 3] = 255;
        }
    }
    const color = newPixelBuffer(size);
    const cd = color.data;
    for (let y = 0; y < size; y++) {
        const row = Math.floor(y / cellH);
        const yInCell = y - row * cellH;
        const stagger = row % 2 * (cellW * 0.5);
        for (let x = 0; x < size; x++) {
            const xs = (x + stagger) % size;
            const col = Math.floor(xs / cellW);
            const xInCell = xs - col * cellW;
            const inMortarX = xInCell < mortar || xInCell > cellW - mortar;
            const inMortarY = yInCell < mortar || yInCell > cellH - mortar;
            let r, g, b;
            if (inMortarX || inMortarY) {
                const m = 0.04 * periodicHash2(x, y, size, size);
                r = mortarColor[0] + m;
                g = mortarColor[1] + m;
                b = mortarColor[2] + m;
            }
            else {
                const id = periodicHash2(col, row, COLS, ROWS) - 0.5;
                const grain = periodicFbm(x * 0.05, y * 0.05, size * 0.05, size * 0.05, 4) - 0.5;
                const spec = (periodicHash2(x, y, size, size) - 0.5) * blockNoise;
                r = clamp01(baseColor[0] + 0.1 * id + 0.12 * grain + spec);
                g = clamp01(baseColor[1] + 0.08 * id + 0.12 * grain + spec);
                b = clamp01(baseColor[2] + 0.06 * id + 0.1 * grain + spec);
            }
            const i = (y * size + x) * 4;
            cd[i] = Math.round(r * 255);
            cd[i + 1] = Math.round(g * 255);
            cd[i + 2] = Math.round(b * 255);
            cd[i + 3] = 255;
        }
    }
    return {
        color,
        normal: heightToNormal(hgt, normalStrength),
        mr: flatMR(size, roughness, 0),
        flatColor: baseColor
    };
}
export { paintStoneBlock };
