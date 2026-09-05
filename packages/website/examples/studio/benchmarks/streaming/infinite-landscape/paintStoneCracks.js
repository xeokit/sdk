import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";
const { newPixelBuffer, heightToNormal, paintMR, periodicNoise2, periodicFbm, clamp01 } = xeokit.model.generation.paintMaterials;
function paintStoneCracks(size, options = {}) {
    const PERIOD = options.period ?? 8;
    const SHARP = options.crackSharpness ?? 10;
    const DEPTH = options.crackDepth ?? 0.55;
    const DENS = options.crackDensity ?? 0.55;
    const baseColor = options.color ?? [0.62, 0.6, 0.55];
    const crackColor = options.crackColor ?? [0.1, 0.09, 0.08];
    const normalStrength = options.normalStrength ?? 4;
    const roughness = options.roughness ?? 0.85;
    const grainAmp = options.grainAmp ?? 0.08;
    function crackMask(px, py) {
        const fx = px / size, fy = py / size;
        const x = fx * PERIOD, y = fy * PERIOD;
        const p = PERIOD;
        const jx = (periodicNoise2(x * 0.7, y * 0.7, p * 0.7, p * 0.7) - 0.5) * 0.6;
        const jy = (periodicNoise2(x * 0.7 + 17.3, y * 0.7 + 31.1, p * 0.7, p * 0.7) - 0.5) * 0.6;
        const fbm = periodicFbm(x + jx, y + jy, p, p, 4);
        const ridge = 1 - Math.abs(2 * fbm - 1);
        const sharp = Math.pow(ridge, SHARP);
        const slow = periodicFbm(x * 0.3, y * 0.3, p * 0.3, p * 0.3, 3);
        const dens = clamp01((slow - DENS) * 6);
        return sharp * dens;
    }
    const hgt = newPixelBuffer(size);
    const col = newPixelBuffer(size);
    const hd = hgt.data;
    const cd = col.data;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const m = crackMask(x, y);
            const grain = (periodicFbm(x * 0.05, y * 0.05, size * 0.05, size * 0.05, 4) - 0.5) * 0.18;
            const spec = (periodicNoise2(x * 0.5, y * 0.5, size, size) - 0.5) * grainAmp;
            const tint = grain + spec;
            const r = clamp01(baseColor[0] * (1 + tint) * (1 - m) + crackColor[0] * m);
            const g = clamp01(baseColor[1] * (1 + tint) * (1 - m) + crackColor[1] * m);
            const b = clamp01(baseColor[2] * (1 + tint) * (1 - m) + crackColor[2] * m);
            const h = clamp01(0.7 + tint * 0.5 - m * DEPTH);
            const i = (y * size + x) * 4;
            cd[i] = Math.round(r * 255);
            cd[i + 1] = Math.round(g * 255);
            cd[i + 2] = Math.round(b * 255);
            cd[i + 3] = 255;
            const hv = Math.round(h * 255);
            hd[i] = hd[i + 1] = hd[i + 2] = hv;
            hd[i + 3] = 255;
        }
    }
    const mr = paintMR(size, (x, y) => [
        clamp01(roughness + 0.1 * crackMask(x, y)),
        0
    ]);
    return {
        color: col,
        normal: heightToNormal(hgt, normalStrength),
        mr,
        flatColor: baseColor
    };
}
export { paintStoneCracks };
