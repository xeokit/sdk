/**
 * In-memory tile tree for streaming. `buildTileTree` fetches a `tileset.json`
 * and produces a tree of {@link TileNode}, each carrying its composed
 * tile-to-world transform, geometric error, content URI, and a world-space
 * bounding sphere derived from the tile's bounding volume. The streamer walks
 * this tree per camera change to select tiles by screen-space error.
 *
 * Scope: explicit `children` hierarchies and `box` / `sphere` / `region`
 * bounding volumes. A tile with `implicitTiling` becomes an
 * {@link TileNode.implicit | implicit} node carrying its root box and templated
 * URIs — its subtree is expanded lazily during selection, not built here. A
 * `region` (geodetic extent) is converted to an ECEF world-space sphere.
 */

import {createMat4Float64, type Mat4, mulMat4} from "../../../base/math/matrix";
import type {Vec3} from "../../../base/math/vector";

/**
 * Implicit-tiling spec carried by an implicit {@link TileNode}, enough to expand
 * its subtree lazily by Morton index during selection (box subdivision for
 * per-tile bounding volumes, templated subtree / content URIs).
 */
export interface ImplicitSpec {
  subdivisionScheme: string;
  subtreeLevels: number;
  /** Total levels available (root level 0 .. availableLevels-1). */
  availableLevels: number;
  /** `subtrees.uri` template (`{level}/{x}/{y}/{z}`). */
  subtreeTemplate: string;
  /** Content `uri` template, if the tile has content. */
  contentTemplate?: string;
  /** Root tile's local-frame `box` (12 numbers) subdivided per coordinate. */
  rootBox: number[];
}

export interface TileNode {
  id: string;
  /** Tile-to-world transform (Z-up), composed down the tree. */
  worldMatrix: Mat4;
  geometricError: number;
  refine: "ADD" | "REPLACE";
  /** Relative content URI (templated URIs are not expanded here). */
  contentUri?: string;
  /** Directory the content URI resolves against. */
  baseUri?: string;
  /** World-space bounding sphere centre. */
  center: Vec3;
  /** World-space bounding sphere radius. */
  radius: number;
  children: TileNode[];
  /** When set, this node's subtree is expanded lazily from implicit tiling. */
  implicit?: ImplicitSpec;
}

const IDENTITY: Mat4 = createMat4Float64([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function buildTileTree(tileset: any, baseUri: string | undefined): TileNode {
  if (!tileset?.root) {
    throw new Error("[TilesetStreamer] tileset.json has no root tile");
  }
  let nextId = 0;
  const build = (tile: any, parentWorld: Mat4, inheritedRefine: string): TileNode => {
    const worldMatrix = tile.transform
      ? mulMat4(createMat4Float64(parentWorld), createMat4Float64(tile.transform), createMat4Float64())
      : createMat4Float64(parentWorld);
    const refine = (tile.refine || inheritedRefine || "REPLACE").toUpperCase() === "ADD" ? "ADD" : "REPLACE";
    const content = tile.content || (tile.contents && tile.contents[0]);
    const {center, radius} = boundingSphere(tile.boundingVolume, worldMatrix);
    const implicitTiling = tile.implicitTiling || tile.extensions?.["3DTILES_implicit_tiling"];
    const implicit = implicitTiling && tile.boundingVolume?.box
      ? {
          subdivisionScheme: implicitTiling.subdivisionScheme,
          subtreeLevels: implicitTiling.subtreeLevels,
          availableLevels:
            implicitTiling.availableLevels ?? ((implicitTiling.maximumLevel ?? Infinity) + 1),
          subtreeTemplate: implicitTiling.subtrees.uri,
          contentTemplate: content && (content.uri || content.url),
          rootBox: tile.boundingVolume.box as number[],
        }
      : undefined;
    return {
      id: `t${nextId++}`,
      worldMatrix,
      geometricError: typeof tile.geometricError === "number" ? tile.geometricError : 0,
      refine,
      // Implicit nodes expose no literal content URI — selection emits content
      // tiles with templated URIs; an explicit node's URI loads directly.
      contentUri: implicit ? undefined : content && (content.uri || content.url),
      baseUri,
      center,
      radius,
      children: implicit ? [] : (tile.children || []).map((c: any) => build(c, worldMatrix, refine)),
      implicit,
    };
  };
  return build(tileset.root, IDENTITY, "REPLACE");
}

/** Transforms a `box` / `sphere` / `region` bounding volume into a world-space sphere. */
function boundingSphere(volume: any, world: Mat4): {center: Vec3; radius: number} {
  if (volume?.box) {
    const b = volume.box;
    const center = transformPoint(world, [b[0], b[1], b[2]]);
    // Conservative enclosing radius: sum of the three transformed half-axis lengths.
    const radius =
      vecLength(transformDir(world, [b[3], b[4], b[5]])) +
      vecLength(transformDir(world, [b[6], b[7], b[8]])) +
      vecLength(transformDir(world, [b[9], b[10], b[11]]));
    return {center, radius};
  }
  if (volume?.sphere) {
    const s = volume.sphere;
    const center = transformPoint(world, [s[0], s[1], s[2]]);
    return {center, radius: s[3] * maxAxisScale(world)};
  }
  if (volume?.region) {
    // A `region` is a geodetic extent (EPSG:4979); the tile transform does not
    // apply to it. It is converted directly to an ECEF (Earth-fixed) sphere.
    return regionSphere(volume.region);
  }
  // No usable volume: anchor at the transform origin with no extent, so
  // distance-based SSE always refines this tile.
  return {center: transformPoint(world, [0, 0, 0]), radius: 0};
}

// WGS84 ellipsoid: semi-major axis (m) and first eccentricity squared.
const WGS84_A = 6378137.0;
const WGS84_E2 = 6.69437999014e-3;

/**
 * WGS84 geodetic (longitude, latitude in radians; height in metres) to ECEF
 * (Earth-Centered, Earth-Fixed) Cartesian metres.
 */
export function geodeticToEcef(longitude: number, latitude: number, height: number): Vec3 {
  const cosLat = Math.cos(latitude);
  const sinLat = Math.sin(latitude);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  return [
    (n + height) * cosLat * Math.cos(longitude),
    (n + height) * cosLat * Math.sin(longitude),
    (n * (1 - WGS84_E2) + height) * sinLat,
  ];
}

/**
 * World-space (ECEF) sphere enclosing a 3D Tiles `region`
 * `[west, south, east, north, minHeight, maxHeight]` (radians / metres): the
 * sphere centred at the region's mid-point that contains its eight corners.
 */
export function regionSphere(region: number[]): {center: Vec3; radius: number} {
  const [west, south, east, north, minHeight, maxHeight] = region;
  const center = geodeticToEcef((west + east) / 2, (south + north) / 2, (minHeight + maxHeight) / 2);
  let radius = 0;
  for (const lon of [west, east]) {
    for (const lat of [south, north]) {
      for (const h of [minHeight, maxHeight]) {
        const corner = geodeticToEcef(lon, lat, h);
        radius = Math.max(radius, Math.hypot(corner[0] - center[0], corner[1] - center[1], corner[2] - center[2]));
      }
    }
  }
  return {center, radius};
}

export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

export function transformDir(m: Mat4, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
  ];
}

export function vecLength(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function maxAxisScale(m: Mat4): number {
  return Math.max(
    vecLength([m[0], m[1], m[2]]),
    vecLength([m[4], m[5], m[6]]),
    vecLength([m[8], m[9], m[10]]),
  );
}
