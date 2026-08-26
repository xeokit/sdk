import {sortSplatsByDepth} from "../sortSplats";

const IDENTITY_VIEW = new Float32Array([1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1]);

describe("sortSplatsByDepth", () => {
  it("orders splats far→near (most-negative camera z first)", () => {
    // Identity view → camera z = world z. z = -1 (near), -10 (far), -5 (mid).
    const positions = new Float32Array([
      0, 0, -1,    // compact 0 → item 100  (near)
      0, 0, -10,   // compact 1 → item 200  (far)
      0, 0, -5,    // compact 2 → item 300  (mid)
    ]);
    const itemIndices = new Uint32Array([100, 200, 300]);

    const sorted = sortSplatsByDepth(positions, itemIndices, IDENTITY_VIEW);

    // Far→near: -10 (200), -5 (300), -1 (100).
    expect(Array.from(sorted)).toEqual([200, 300, 100]);
  });

  it("returns the splat texture item-indices (not compact indices)", () => {
    const positions = new Float32Array([0, 0, -2,  0, 0, -8]);
    const itemIndices = new Uint32Array([42, 7]);
    const sorted = sortSplatsByDepth(positions, itemIndices, IDENTITY_VIEW);
    expect(Array.from(sorted)).toEqual([7, 42]); // item 7 is farther (-8)
  });

  it("handles empty input", () => {
    expect(sortSplatsByDepth(new Float32Array(0), new Uint32Array(0), IDENTITY_VIEW)).toHaveLength(0);
  });

  it("is stable under a translated view (depth uses view row 2 + translation)", () => {
    // View translated so camera z offset by +100 — relative order preserved.
    const view = new Float32Array([1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 100, 1]);
    const positions = new Float32Array([0, 0, -1,  0, 0, -10]);
    const sorted = sortSplatsByDepth(positions, new Uint32Array([1, 2], ), view);
    expect(Array.from(sorted)).toEqual([2, 1]); // -10 still farther
  });
});
