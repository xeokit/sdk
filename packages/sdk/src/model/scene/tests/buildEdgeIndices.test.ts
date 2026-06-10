import {buildEdgeIndices} from "../buildEdgeIndices";

// Normalise the flat edge-index array into a Set of "min,max" pair keys so tests
// can assert on the *set* of emitted edges regardless of pair ordering.
function edgePairs(edges: ArrayLike<number>): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i], b = edges[i + 1];
    set.add(Math.min(a, b) + "," + Math.max(a, b));
  }
  return set;
}

describe("buildEdgeIndices", () => {

  it("culls the shared diagonal of a flat (coplanar) quad, keeping only the 4 boundary edges", () => {
    // Unit quad in the XY plane: two coplanar triangles sharing the 0-2 diagonal.
    const positions = [0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0];
    const indices = [0, 1, 2,  0, 2, 3];

    const edges = buildEdgeIndices(positions, indices, null as any, 1);
    const pairs = edgePairs(edges);

    // The 0-2 diagonal is shared by two coplanar faces (dot of normals == 1 > cos(1deg)) => culled.
    expect(pairs.has("0,2")).toBe(false);
    // The four boundary edges (each belonging to a single face) survive.
    expect(edges.length).toBe(8); // 4 edges * 2 indices
    expect(pairs).toEqual(new Set(["0,1", "1,2", "2,3", "0,3"]));
  });

  it("emits the shared edge of two triangles folded at a sharp (90deg) angle", () => {
    // Two triangles hinged along the 0-1 edge, folded 90 degrees out of plane.
    //   tri A in XY plane, tri B in XZ plane, sharing vertices 0 and 1.
    const positions = [
      0, 0, 0,   // 0  shared
      1, 0, 0,   // 1  shared
      0, 1, 0,   // 2  tri A (in +Y)
      0, 0, 1,   // 3  tri B (in +Z)
    ];
    const indices = [0, 1, 2,  0, 1, 3];

    const edges = buildEdgeIndices(positions, indices, null as any, 1);
    const pairs = edgePairs(edges);

    // The hinge edge 0-1 is shared but the faces meet at 90deg => emitted.
    expect(pairs.has("0,1")).toBe(true);
    // All other edges are boundary edges => emitted too. 5 distinct edges total.
    expect(pairs).toEqual(new Set(["0,1", "0,2", "1,2", "0,3", "1,3"]));
    expect(edges.length).toBe(10);
  });

  it("respects the angle threshold in degrees: a high threshold culls the folded shared edge", () => {
    // Same 90deg fold as above; with a threshold above 90deg the dihedral no longer
    // exceeds it, so the shared edge is culled.
    const positions = [
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];
    const indices = [0, 1, 2,  0, 1, 3];

    // thresholdDot = cos(91deg) < 0; the 90deg dihedral has normal-dot 0 > thresholdDot => culled.
    const edges = buildEdgeIndices(positions, indices, null as any, 91);
    const pairs = edgePairs(edges);

    expect(pairs.has("0,1")).toBe(false);
    // Only the boundary edges remain.
    expect(pairs).toEqual(new Set(["0,2", "1,2", "0,3", "1,3"]));
  });

  it("emits every shared edge of a cube (all dihedrals are 90deg)", () => {
    // Axis-aligned unit cube, 12 triangles. Every interior shared edge between
    // two triangles of the *same* face is coplanar (culled); every edge shared
    // across two cube faces is a 90deg crease (emitted). The 12 cube edges remain.
    const positions = [
      0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0, // back  (z=0) verts 0-3
      0, 0, 1,  1, 0, 1,  1, 1, 1,  0, 1, 1, // front (z=1) verts 4-7
    ];
    const indices = [
      // back
      0, 2, 1,  0, 3, 2,
      // front
      4, 5, 6,  4, 6, 7,
      // bottom
      0, 1, 5,  0, 5, 4,
      // top
      3, 7, 6,  3, 6, 2,
      // left
      0, 4, 7,  0, 7, 3,
      // right
      1, 2, 6,  1, 6, 5,
    ];

    const edges = buildEdgeIndices(positions, indices, null as any, 1);
    const pairs = edgePairs(edges);

    // A cube has 12 edges; each is a 90deg crease => all emitted, none of the
    // 6 coplanar face diagonals survive.
    expect(pairs.size).toBe(12);
    expect(edges.length).toBe(24);
    // Spot-check: face diagonals (0-2, 4-6) are culled, real cube edges are present.
    expect(pairs.has("0,2")).toBe(false);
    expect(pairs.has("4,6")).toBe(false);
    expect(pairs.has("0,1")).toBe(true);
    expect(pairs.has("0,4")).toBe(true);
  });
});
