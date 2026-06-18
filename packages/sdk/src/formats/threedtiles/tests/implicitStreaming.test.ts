import * as fs from "fs";
import * as path from "path";
import {createMat4Float64, lookAtMat4v, perspectiveMat4} from "../../../base/math/matrix";
import {Scene} from "../../../model/scene/Scene";
import {geometricErrorAtLevel, subdividedSphere} from "../implicit/boxSubdivision";
import {resolveUrl} from "../parseTileset";
import {buildTileTree} from "../streaming/TileTree";
import {selectStreaming} from "../streaming/selectStreaming";
import {TilesetStreamer} from "../streaming/TilesetStreamer";
import type {CameraState} from "../streaming/screenSpaceError";

const IDENTITY = createMat4Float64([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

describe("box subdivision", () => {
  // Root box centred at origin, unit half-axes.
  const root = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];

  it("subdivides a QUADTREE cell (X/Y split, Z full)", () => {
    // Level 1, lower-left cell: centre (-0.5,-0.5,0), half X/Y = 0.5, Z stays 1.
    const a = subdividedSphere(root, 2, 1, [0, 0], IDENTITY);
    expect(a.center).toEqual([-0.5, -0.5, 0]);
    expect(a.radius).toBeCloseTo(0.5 + 0.5 + 1, 6);

    // Opposite cell: centre (0.5,0.5,0).
    const b = subdividedSphere(root, 2, 1, [1, 1], IDENTITY);
    expect(b.center).toEqual([0.5, 0.5, 0]);
  });

  it("subdivides an OCTREE cell (X/Y/Z split)", () => {
    const c = subdividedSphere(root, 3, 1, [1, 1, 1], IDENTITY);
    expect(c.center).toEqual([0.5, 0.5, 0.5]);
    expect(c.radius).toBeCloseTo(0.5 * 3, 6);
  });

  it("applies the world transform to subdivided cells", () => {
    const world = createMat4Float64([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]);
    const a = subdividedSphere(root, 2, 1, [0, 0], world);
    expect(a.center).toEqual([9.5, 19.5, 30]);
  });

  it("halves the geometric error per level", () => {
    expect(geometricErrorAtLevel(32, 0)).toBe(32);
    expect(geometricErrorAtLevel(32, 5)).toBe(1);
  });
});

// Real Cesium implicit-tiling sample (CesiumGS/3d-tiles-samples, Apache-2.0),
// vendored under fixtures/. ADD refinement, content only at level 5 (the 32
// sparse leaves), subtreeLevels 3, availableLevels 6.
const DIR = path.resolve(__dirname, "fixtures/SparseImplicitQuadtree");

function countingDiskFetch() {
  let subtreeFetches = 0;
  const fetch = (url: string): Promise<ArrayBuffer> => {
    if (url.endsWith(".subtree")) subtreeFetches++;
    const b = fs.readFileSync(url);
    return Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  };
  return {fetch, subtrees: () => subtreeFetches};
}

function implicitTree() {
  const tileset = JSON.parse(fs.readFileSync(path.join(DIR, "tileset.json"), "utf8"));
  return buildTileTree(tileset, `${DIR}/`);
}

function selectOpts(fetch: (url: string) => Promise<ArrayBuffer>) {
  return {maxScreenSpaceError: 16, fetchArrayBuffer: fetch, resolveUrl, subtreeCache: new Map()};
}

describe("buildTileTree — implicit node", () => {
  it("flags the implicit root and carries its spec", () => {
    const tree = implicitTree();
    expect(tree.implicit).toBeDefined();
    expect(tree.implicit!.subdivisionScheme).toBe("QUADTREE");
    expect(tree.implicit!.subtreeLevels).toBe(3);
    expect(tree.implicit!.availableLevels).toBe(6);
    // No literal content URI — selection emits templated content tiles.
    expect(tree.contentUri).toBeUndefined();
    expect(tree.children).toEqual([]);
  });
});

describe("selectStreaming — implicit lazy expansion", () => {
  const far: CameraState = {eye: [0.5, 0.5, 5000], viewportHeight: 1000, fov: 60};
  const near: CameraState = {eye: [0.5, 0.5, 2], viewportHeight: 1000, fov: 60};

  it("selects nothing far and fetches only the root subtree", async () => {
    const fetch = countingDiskFetch();
    const sel = await selectStreaming(implicitTree(), far, selectOpts(fetch.fetch));
    expect(sel.length).toBe(0);
    expect(fetch.subtrees()).toBe(1);
  });

  it("selects every leaf near and fetches subtrees deeper (lazy expansion)", async () => {
    const contentFiles = fs.readdirSync(path.join(DIR, "content")).filter(f => f.endsWith(".glb"));
    const fetch = countingDiskFetch();
    const sel = await selectStreaming(implicitTree(), near, selectOpts(fetch.fetch));
    // Content exists only at level 5; the near camera reaches all 32 leaves.
    expect(sel.length).toBe(contentFiles.length);
    expect(sel.every(n => /content_5__/.test(n.contentUri!))).toBe(true);
    // Root subtree + the child subtrees crossed to reach level 5.
    expect(fetch.subtrees()).toBeGreaterThan(1);
  });

  it("culls everything when the tiles are behind the camera", async () => {
    // Eye near the tiles but looking away (+Z), so the slab at z≈0 is behind it.
    const view = lookAtMat4v([0.5, 0.5, 2], [0.5, 0.5, 5], [0, 1, 0]);
    const proj = perspectiveMat4((60 * Math.PI) / 180, 1, 0.01, 10000);
    const fetch = countingDiskFetch();
    const sel = await selectStreaming(
      implicitTree(),
      {...near, viewMatrix: view, projMatrix: proj},
      selectOpts(fetch.fetch),
    );
    expect(sel.length).toBe(0);
  });
});

describe("TilesetStreamer — implicit tileset", () => {
  const far: CameraState = {eye: [0.5, 0.5, 5000], viewportHeight: 1000, fov: 60};
  const near: CameraState = {eye: [0.5, 0.5, 2], viewportHeight: 1000, fov: 60};

  it("loads the selected leaves near, unloads them when backing out, and caches subtrees", async () => {
    const contentFiles = fs.readdirSync(path.join(DIR, "content")).filter(f => f.endsWith(".glb"));
    const fetch = countingDiskFetch();
    const scene = new Scene();
    const streamer = new TilesetStreamer({scene, tree: implicitTree(), fetchArrayBuffer: fetch.fetch});

    await streamer.update(near);
    expect(streamer.loadedCount).toBe(contentFiles.length);
    expect(Object.keys(scene.models).length).toBe(contentFiles.length);
    const afterFirst = fetch.subtrees();

    // Re-running the same camera reuses the parsed subtrees (no refetch).
    await streamer.update(near);
    expect(fetch.subtrees()).toBe(afterFirst);

    // Backing out unloads every tile.
    await streamer.update(far);
    expect(streamer.loadedCount).toBe(0);
    expect(Object.keys(scene.models).length).toBe(0);

    streamer.destroy();
  });
});
