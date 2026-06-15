import {packSplats, SPLAT_FLOATS_PER_ITEM} from "../utils/packSplats";

describe("packSplats", () => {
  it("packs one splat into 16 floats: decompressed centre, opacity, colour, covariance", () => {
    // One splat. AABB [0,0,0..10,10,10]; quantised centre 32768/65535 ≈ midpoint (5,5,5).
    // Identity rotation + scale (2,1,3) -> Σ = diag(4,1,9).
    const out = packSplats({
      positionsCompressed: [32768, 32768, 32768],
      aabb: [0, 0, 0, 10, 10, 10],
      scales: [2, 1, 3],
      rotations: [0, 0, 0, 1],          // xyzw identity
      colorsCompressed: [255, 128, 0, 64],
    });

    expect(out).toHaveLength(SPLAT_FLOATS_PER_ITEM);
    const r = Array.from(out).map(v => +v.toFixed(4));
    // centre ≈ (5,5,5)
    expect(r[0]).toBeCloseTo(5, 2);
    expect(r[1]).toBeCloseTo(5, 2);
    expect(r[2]).toBeCloseTo(5, 2);
    expect(r[3]).toBeCloseTo(64 / 255, 4);   // opacity
    expect(r[4]).toBeCloseTo(1, 4);          // r = 255/255
    expect(r[5]).toBeCloseTo(128 / 255, 4);  // g
    expect(r[6]).toBe(0);                     // b = 0/255
    expect(r[7]).toBe(0);                     // meshPickId (default 0)
    // Σ = diag(4,1,9) -> [Σxx,Σxy,Σxz, _, Σyy,Σyz,Σzz, _]
    expect(r.slice(8, 12)).toEqual([4, 0, 0, 0]);
    expect(r.slice(12, 16)).toEqual([1, 0, 9, 0]);
  });

  it("writes the meshPickId into the colour texel's spare channel", () => {
    const out = packSplats({
      positionsCompressed: [32768, 32768, 32768],
      aabb: [0, 0, 0, 10, 10, 10],
      scales: [1, 1, 1],
      rotations: [0, 0, 0, 1],
      colorsCompressed: [255, 255, 255, 255],
    }, undefined, 7);

    expect(out[7]).toBe(7);   // o + 7 carries the owning mesh's pick id
  });

  it("applies a world matrix: translation shifts centres, leaves covariance", () => {
    // Translate by (10,20,30); identity rotation/scale (2,1,3) -> Σ diag(4,1,9).
    const T = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  10, 20, 30, 1] as unknown as number[];
    const out = packSplats({
      positionsCompressed: [0, 0, 0],
      aabb: [0, 0, 0, 10, 10, 10],
      scales: [2, 1, 3],
      rotations: [0, 0, 0, 1],
    }, T as any);
    const r = Array.from(out).map(v => +v.toFixed(4));
    expect(r.slice(0, 3)).toEqual([10, 20, 30]);          // centre translated
    expect(r.slice(8, 12)).toEqual([4, 0, 0, 0]);          // Σ unchanged (M3 = I)
    expect(r.slice(12, 16)).toEqual([1, 0, 9, 0]);
  });

  it("applies a 180°-about-X world matrix: negates centre Y/Z and Σ off-diagonals xy/xz", () => {
    // M = diag(1,-1,-1) (proper rotation). centre (1,2,3) -> (1,-2,-3).
    // For Σ from scale (2,3,4) rot identity = diag(4,9,16): off-diagonals are 0,
    // so use a rotated splat to get non-zero Σxy and check its sign flips.
    const X180 = [1, 0, 0, 0,  0, -1, 0, 0,  0, 0, -1, 0,  0, 0, 0, 1] as unknown as number[];
    // 45° about Z gives a non-zero Σxy.
    const s = Math.sin(Math.PI / 8), w = Math.cos(Math.PI / 8); // 45° -> quat (0,0,sin22.5,cos22.5)
    const plain = packSplats({positionsCompressed: [40000, 40000, 40000], aabb: [0,0,0,1,1,1], scales: [2,1,1], rotations: [0,0,s,w]});
    const flipped = packSplats({positionsCompressed: [40000, 40000, 40000], aabb: [0,0,0,1,1,1], scales: [2,1,1], rotations: [0,0,s,w]}, X180 as any);
    // Σxy (index 9) sign flips under X-180; Σxx (8), Σyy (12), Σzz (14) unchanged.
    expect(+flipped[9].toFixed(5)).toBeCloseTo(-(+plain[9].toFixed(5)), 4);
    expect(+flipped[8].toFixed(5)).toBeCloseTo(+plain[8].toFixed(5), 4);
    expect(+flipped[12].toFixed(5)).toBeCloseTo(+plain[12].toFixed(5), 4);
    // centre Y,Z negated (centre ≈ (0.61,0.61,0.61) -> (0.61,-0.61,-0.61))
    expect(+flipped[1].toFixed(4)).toBeCloseTo(-(+plain[1].toFixed(4)), 4);
    expect(+flipped[2].toFixed(4)).toBeCloseTo(-(+plain[2].toFixed(4)), 4);
    expect(+flipped[0].toFixed(4)).toBeCloseTo(+plain[0].toFixed(4), 4);
  });

  it("packs N splats contiguously and defaults missing colours to white/opaque", () => {
    const out = packSplats({
      positionsCompressed: [0, 0, 0,  65535, 65535, 65535],
      aabb: [0, 0, 0, 1, 1, 1],
      scales: [1, 1, 1,  1, 1, 1],
      rotations: [0, 0, 0, 1,  0, 0, 0, 1],
      // no colorsCompressed
    });
    expect(out).toHaveLength(2 * SPLAT_FLOATS_PER_ITEM);
    // splat 0 centre = (0,0,0); splat 1 centre = (1,1,1)
    expect(Array.from(out.slice(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(out.slice(16, 19)).map(v => +v.toFixed(4))).toEqual([1, 1, 1]);
    // default colour white, opaque
    expect(out[3]).toBe(1); expect(out[4]).toBe(1); expect(out[5]).toBe(1); expect(out[6]).toBe(1);
  });
});
