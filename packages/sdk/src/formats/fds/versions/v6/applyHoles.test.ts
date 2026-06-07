import {applyHoles, subtract} from "./applyHoles";
import type {FDSObst, FDSHole, FDSXB} from "./types";

const ext = new Map<string, unknown>();
const obst = (xb: FDSXB): FDSObst => ({xb, extras: ext});
const hole = (xb: FDSXB): FDSHole => ({xb, extras: ext});

describe("FDS subtract (single hole)", () => {

  it("no overlap → original box unchanged", () => {
    const r: FDSXB = [0, 1, 0, 1, 0, 1];
    const h: FDSXB = [2, 3, 2, 3, 2, 3];
    expect(subtract(r, h)).toEqual([r]);
  });

  it("fully contained → empty remainder", () => {
    const r: FDSXB = [1, 2, 1, 2, 1, 2];
    const h: FDSXB = [0, 5, 0, 5, 0, 5];
    expect(subtract(r, h)).toEqual([]);
  });

  it("corner cut → 3 remainder boxes (one per axis the corner clips)", () => {
    const r: FDSXB = [0, 2, 0, 2, 0, 2];
    const h: FDSXB = [1, 3, 1, 3, 1, 3];   // protrudes out +x, +y, +z
    const rem = subtract(r, h);
    expect(rem).toHaveLength(3);
    const totalVol = rem.reduce((s, b) => s + vol(b), 0);
    expect(totalVol).toBeCloseTo(vol(r) - vol([1, 2, 1, 2, 1, 2]));
  });

  it("through-tunnel cut → 4 remainder boxes around the tunnel", () => {
    // Tunnel along Z: hole spans full Z, partial X & Y.
    const r: FDSXB = [0, 4, 0, 4, 0, 4];
    const h: FDSXB = [1, 3, 1, 3, -1, 5];
    const rem = subtract(r, h);
    expect(rem).toHaveLength(4);
    expect(rem.reduce((s, b) => s + vol(b), 0))
      .toBeCloseTo(vol(r) - vol([1, 3, 1, 3, 0, 4]));
  });

  it("fully-inside hole → 6 remainder boxes (shell)", () => {
    const r: FDSXB = [0, 3, 0, 3, 0, 3];
    const h: FDSXB = [1, 2, 1, 2, 1, 2];
    const rem = subtract(r, h);
    expect(rem).toHaveLength(6);
    expect(rem.reduce((s, b) => s + vol(b), 0))
      .toBeCloseTo(vol(r) - vol(h));
  });
});


describe("FDS applyHoles (multiple obsts × holes)", () => {

  it("preserves obsts the holes don't touch", () => {
    const obsts = [obst([0, 1, 0, 1, 0, 1]), obst([10, 11, 10, 11, 10, 11])];
    const holes = [hole([5, 6, 5, 6, 5, 6])];
    const out = applyHoles(obsts, holes);
    expect(out).toHaveLength(2);
    expect(out[0].xb).toEqual([0, 1, 0, 1, 0, 1]);
    expect(out[1].xb).toEqual([10, 11, 10, 11, 10, 11]);
  });

  it("drops obsts fully enclosed by any hole", () => {
    const obsts = [obst([1, 2, 1, 2, 1, 2])];
    const holes = [hole([0, 3, 0, 3, 0, 3])];
    expect(applyHoles(obsts, holes)).toHaveLength(0);
  });

  it("composes multiple holes against the same obst", () => {
    const obsts = [obst([0, 4, 0, 4, 0, 4])];
    const holes = [hole([0, 1, 0, 4, 0, 4]), hole([3, 4, 0, 4, 0, 4])];  // strips off X-min and X-max slabs
    const out = applyHoles(obsts, holes);
    expect(out.length).toBeGreaterThanOrEqual(1);
    const totalVol = out.reduce((s, p) => s + vol(p.xb), 0);
    // 4*4*4 = 64 minus 2 slabs of 1*4*4 = 16 each → 32.
    expect(totalVol).toBeCloseTo(32);
  });
});


function vol(b: FDSXB): number {
  return Math.max(0, b[1] - b[0]) * Math.max(0, b[3] - b[2]) * Math.max(0, b[5] - b[4]);
}
