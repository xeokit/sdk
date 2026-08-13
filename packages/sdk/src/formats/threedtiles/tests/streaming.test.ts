import {Scene} from "../../../model/scene/Scene";
import {TrianglesPrimitive} from "../../../base/constants";
import {lookAtMat4v, perspectiveMat4} from "../../../base/math/matrix";
import {GLTFExporter} from "../../gltf/GLTFExporter";
import {buildTileTree, geodeticToEcef, regionSphere} from "../streaming/TileTree";
import {distanceToTile, screenSpaceError, selectTiles, type CameraState} from "../streaming/screenSpaceError";
import {TilesetStreamer} from "../streaming/TilesetStreamer";

const BASE = "http://tiles/";

// A unit box bounding volume at a given world centre (12 numbers: centre + 3 half-axes).
function box(cx: number, cy: number, cz: number): number[] {
  return [cx, cy, cz, 1, 0, 0, 0, 1, 0, 0, 0, 1];
}

function tilesetWithChildren() {
  return {
    asset: {version: "1.1"},
    geometricError: 200,
    root: {
      boundingVolume: {box: box(0, 0, 0)},
      geometricError: 100,
      refine: "REPLACE",
      content: {uri: "root.glb"},
      children: [
        {boundingVolume: {box: box(0, 0, 0)}, geometricError: 0, content: {uri: "a.glb"}},
        {boundingVolume: {box: box(0, 0, 0)}, geometricError: 0, content: {uri: "b.glb"}},
      ],
    },
  };
}

async function buildGLB(): Promise<Uint8Array> {
  const positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
  const aabb = [0, 0, 0, 1, 1, 1];
  const q = new Uint16Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) q[i + k] = Math.round(((positions[i + k] - aabb[k]) / (aabb[k + 3] - aabb[k])) * 65535);
  }
  const geom = {id: "g1", primitive: TrianglesPrimitive, positionsCompressed: q, aabb, indices: new Uint32Array([0, 1, 2, 0, 2, 3])};
  const mesh = {id: "mesh1", geometry: geom, color: [1, 0, 0], opacity: 1, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]};
  const sceneModel: any = {id: "src", scene: {coordinateSystem: {}}, textures: {}, materials: {}, geometries: {g1: geom}, objects: {Building1: {id: "Building1", meshes: [mesh]}}};
  return new GLTFExporter().write({sceneModel} as any);
}

describe("TileTree", () => {
  it("builds a world-space tile tree with bounding spheres", () => {
    const tree = buildTileTree(tilesetWithChildren(), BASE);
    expect(tree.geometricError).toBe(100);
    expect(tree.contentUri).toBe("root.glb");
    expect(tree.children.length).toBe(2);
    // Box half-axes (1,0,0)+(0,1,0)+(0,0,1) → conservative radius 3, centred at origin.
    expect(tree.radius).toBeCloseTo(3, 6);
    expect(tree.center).toEqual([0, 0, 0]);
  });

  it("composes tile transforms into world bounding-sphere centres", () => {
    const tileset = {
      asset: {version: "1.1"},
      root: {
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1],
        boundingVolume: {box: box(0, 0, 0)},
        geometricError: 0,
        content: {uri: "r.glb"},
      },
    };
    const tree = buildTileTree(tileset, BASE);
    expect(tree.center[0]).toBeCloseTo(10, 6);
    expect(tree.center[1]).toBeCloseTo(20, 6);
    expect(tree.center[2]).toBeCloseTo(30, 6);
  });
});

describe("region bounding volumes", () => {
  it("converts WGS84 geodetic to ECEF at reference points", () => {
    // Prime meridian / equator / sea level → +X semi-major axis.
    const a = geodeticToEcef(0, 0, 0);
    expect(a[0]).toBeCloseTo(6378137, 3);
    expect(Math.hypot(a[1], a[2])).toBeLessThan(1e-3);

    // North pole → +Z semi-minor axis (a·sqrt(1-e²) ≈ 6356752.3).
    const b = geodeticToEcef(0, Math.PI / 2, 0);
    expect(b[2]).toBeCloseTo(6356752.314, 2);
    expect(Math.hypot(b[0], b[1])).toBeLessThan(1e-3);

    // 90° east / equator → +Y semi-major axis.
    const c = geodeticToEcef(Math.PI / 2, 0, 0);
    expect(c[1]).toBeCloseTo(6378137, 3);
    expect(Math.hypot(c[0], c[2])).toBeLessThan(1e-3);
  });

  it("encloses a real region in an ECEF sphere on the Earth's surface", () => {
    // CesiumGS/3d-tiles-samples 1.0/TilesetWithTreeBillboards (Philadelphia, ~40°N).
    const region = [-1.3197004795898053, 0.6988582109, -1.3196595204101946, 0.6988897891, 0, 20];
    const {center, radius} = regionSphere(region);
    // Centre sits at the geocentric radius for ~40° latitude.
    expect(Math.hypot(center[0], center[1], center[2])).toBeGreaterThan(6.35e6);
    expect(Math.hypot(center[0], center[1], center[2])).toBeLessThan(6.39e6);
    // The region spans a few hundred metres, so the sphere is small.
    expect(radius).toBeGreaterThan(0);
    expect(radius).toBeLessThan(2000);
  });

  it("builds a tile tree from a region and ignores the tile transform", () => {
    const region = [-1.3197004795898053, 0.6988582109, -1.3196595204101946, 0.6988897891, 0, 20];
    const expected = regionSphere(region);
    const tileset = {
      asset: {version: "1.1"},
      root: {
        // A transform that would move a box/sphere, but must not affect a region.
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000, 2000, 3000, 1],
        boundingVolume: {region},
        geometricError: 0,
        content: {uri: "r.glb"},
      },
    };
    const tree = buildTileTree(tileset, BASE);
    expect(tree.center[0]).toBeCloseTo(expected.center[0], 3);
    expect(tree.center[1]).toBeCloseTo(expected.center[1], 3);
    expect(tree.center[2]).toBeCloseTo(expected.center[2], 3);
    expect(tree.radius).toBeCloseTo(expected.radius, 3);
  });
});

describe("screen-space error", () => {
  it("computes nearest distance to the bounding sphere", () => {
    const tree = buildTileTree(tilesetWithChildren(), BASE);
    // eye at z=103, sphere centre origin radius 3 → distance 100.
    expect(distanceToTile([0, 0, 103], tree)).toBeCloseTo(100, 6);
  });

  it("returns Infinity at zero distance and scales with viewport / geometric error", () => {
    expect(screenSpaceError(10, 0, 1000, 60)).toBe(Infinity);
    const a = screenSpaceError(10, 100, 1000, 60);
    const b = screenSpaceError(20, 100, 1000, 60);
    expect(b).toBeCloseTo(2 * a, 6);
  });
});

describe("selectTiles", () => {
  it("selects the root when far and refines to leaves when near", () => {
    const tree = buildTileTree(tilesetWithChildren(), BASE);
    const far: CameraState = {eye: [0, 0, 10000], viewportHeight: 1000, fov: 60};
    const near: CameraState = {eye: [0, 0, 50], viewportHeight: 1000, fov: 60};

    const farSel = selectTiles(tree, far, 16).map(n => n.contentUri);
    expect(farSel).toEqual(["root.glb"]);

    const nearSel = selectTiles(tree, near, 16).map(n => n.contentUri).sort();
    expect(nearSel).toEqual(["a.glb", "b.glb"]);
  });
});

describe("frustum culling", () => {
  // A single leaf tile centred at +X (100, 0, 0).
  const tileAtX = () => buildTileTree({
    asset: {version: "1.1"},
    root: {
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 100, 0, 0, 1],
      boundingVolume: {box: [0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5]},
      geometricError: 0,
      content: {uri: "x.glb"},
    },
  }, BASE);

  const proj = perspectiveMat4((60 * Math.PI) / 180, 1, 0.1, 5000);

  it("keeps a tile inside the frustum", () => {
    const view = lookAtMat4v([0, 0, 0], [100, 0, 0], [0, 1, 0]);
    const sel = selectTiles(tileAtX(), {eye: [0, 0, 0], viewportHeight: 800, fov: 60, viewMatrix: view, projMatrix: proj}, 16);
    expect(sel.map(n => n.contentUri)).toEqual(["x.glb"]);
  });

  it("culls a tile outside the frustum (behind the camera)", () => {
    const view = lookAtMat4v([0, 0, 0], [-100, 0, 0], [0, 1, 0]);
    const sel = selectTiles(tileAtX(), {eye: [0, 0, 0], viewportHeight: 800, fov: 60, viewMatrix: view, projMatrix: proj}, 16);
    expect(sel).toEqual([]);
  });
});

describe("TilesetStreamer", () => {
  const far: CameraState = {eye: [0, 0, 10000], viewportHeight: 1000, fov: 60};
  const near: CameraState = {eye: [0, 0, 50], viewportHeight: 1000, fov: 60};

  it("keeps the scene equal to the selected set, unloading deselected tiles", async () => {
    const glb = await buildGLB();
    const glbAB = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
    const scene = new Scene();
    const tree = buildTileTree(tilesetWithChildren(), BASE);

    const streamer = new TilesetStreamer({scene, tree, fetchArrayBuffer: async () => glbAB});

    // Far: only the coarse root tile.
    await streamer.update(far);
    expect(Object.keys(scene.models)).toEqual(["tilestream-t0"]);

    // Near: refine to the two leaves; the root is destroyed (no coarse/fine overlap).
    await streamer.update(near);
    expect(Object.keys(scene.models).sort()).toEqual(["tilestream-t1", "tilestream-t2"]);

    // Back out: the leaves are destroyed and the root returns.
    await streamer.update(far);
    expect(Object.keys(scene.models)).toEqual(["tilestream-t0"]);

    streamer.destroy();
    expect(streamer.loadedCount).toBe(0);
  });

  it("caps the rendered set to the nearest maxLoadedTiles", async () => {
    const glb = await buildGLB();
    const glbAB = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
    const scene = new Scene();
    const tree = buildTileTree(tilesetWithChildren(), BASE);

    const streamer = new TilesetStreamer({scene, tree, maxLoadedTiles: 1, fetchArrayBuffer: async () => glbAB});

    // Near selects both leaves, but the budget keeps only the nearest one.
    await streamer.update(near);
    expect(streamer.loadedCount).toBe(1);
  });

  it("creates streamed tile SceneModels with renderer-friendly streaming hints", async () => {
    const glb = await buildGLB();
    const glbAB = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
    const scene = new Scene();
    const tree = buildTileTree(tilesetWithChildren(), BASE);

    const streamer = new TilesetStreamer({scene, tree, fetchArrayBuffer: async () => glbAB});

    await streamer.update(far);

    const model = scene.models["tilestream-t0"];
    expect(model.updateHint).toBe("static");
    expect(model.lifecycle).toBe("streaming");
    expect(model.memoryPolicy).toBe("stream");
  });

  it("serializes overlapping updates so tiles are not created twice", async () => {
    const glb = await buildGLB();
    const glbAB = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
    const scene = new Scene();
    const tree = buildTileTree(tilesetWithChildren(), BASE);
    const duplicateCreateAttempts: string[] = [];
    const createModel = scene.createModel.bind(scene);
    (scene as any).createModel = (params: any) => {
      if (scene.models[params.id]) duplicateCreateAttempts.push(params.id);
      return createModel(params);
    };

    const streamer = new TilesetStreamer({
      scene,
      tree,
      fetchArrayBuffer: async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return glbAB;
      }
    });

    await Promise.all([
      streamer.update(far),
      streamer.update(near),
      streamer.update(far),
      streamer.update(near),
      streamer.update(far),
      streamer.update(near),
    ]);

    expect(duplicateCreateAttempts).toEqual([]);
    expect(Object.keys(scene.models).sort()).toEqual(["tilestream-t1", "tilestream-t2"]);
  });
});
