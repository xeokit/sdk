/**
 * Async tile selection for streaming, covering explicit tile trees and implicit
 * tiling in one walk. Explicit nodes use the same screen-space-error +
 * REPLACE/ADD logic as the pure {@link selectTiles}; implicit nodes expand
 * their subtree lazily — fetching `.subtree` files only as the SSE/frustum walk
 * descends — and emit the selected content tiles as ordinary {@link TileNode}s
 * so the streamer's load/unload path is unchanged.
 *
 * The pure synchronous {@link selectTiles} remains for explicit-only unit tests;
 * this is the variant the streamer drives because implicit expansion needs to
 * fetch subtrees.
 */

import type {Vec3} from "../../../base/math/vector";
import {Frustum3, intersectFrustum3AABB3, OUTSIDE, setFrustum3} from "../../../base/math/boundaries";
import {parseSubtree, type SubtreeAvailability} from "../implicit/parseSubtree";
import {subdivisionOf} from "../implicit/morton";
import {dirOf, templateUri} from "../implicit/traverseImplicit";
import {geometricErrorAtLevel, subdividedSphere} from "../implicit/boxSubdivision";
import type {ImplicitSpec, TileNode} from "./TileTree";
import {type CameraState, distanceToTile, screenSpaceError} from "./screenSpaceError";

export interface SelectStreamingOptions {
  maxScreenSpaceError: number;
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  resolveUrl: (uri: string, baseUri: string | undefined) => string;
  /** Persisted across calls so each `.subtree` is fetched and parsed once. */
  subtreeCache: Map<string, SubtreeAvailability>;
}

/**
 * Selects the content tiles to render for `camera`, descending while SSE
 * exceeds `maxScreenSpaceError`, frustum-culling tiles outside the view, and
 * expanding implicit subtrees on demand.
 */
export async function selectStreaming(
  root: TileNode,
  camera: CameraState,
  opts: SelectStreamingOptions,
): Promise<TileNode[]> {
  const out: TileNode[] = [];
  const frustum = camera.viewMatrix && camera.projMatrix
    ? setFrustum3(camera.viewMatrix, camera.projMatrix, new Frustum3())
    : null;

  const culled = (center: Vec3, radius: number): boolean => {
    if (!frustum) return false;
    return intersectFrustum3AABB3(
      frustum,
      [center[0] - radius, center[1] - radius, center[2] - radius,
       center[0] + radius, center[1] + radius, center[2] + radius],
    ) === OUTSIDE;
  };
  const sseAt = (geometricError: number, center: Vec3, radius: number): number => {
    const distance = distanceToTile(camera.eye, {center, radius});
    return screenSpaceError(geometricError, distance, camera.viewportHeight, camera.fov);
  };

  const visit = async (node: TileNode): Promise<void> => {
    if (culled(node.center, node.radius)) return;
    if (node.implicit) {
      await visitImplicit(node, node.implicit);
      return;
    }
    const refine = node.children.length > 0 && sseAt(node.geometricError, node.center, node.radius) > opts.maxScreenSpaceError;
    if (node.refine === "ADD") {
      if (node.contentUri) out.push(node);
      if (refine) for (const child of node.children) await visit(child);
    } else if (refine) {
      for (const child of node.children) await visit(child);
    } else if (node.contentUri) {
      out.push(node);
    }
  };

  const visitImplicit = async (node: TileNode, spec: ImplicitSpec): Promise<void> => {
    const sub = subdivisionOf(spec.subdivisionScheme);
    const dims = sub.dims;

    const subtreeFor = async (level: number, coords: number[]): Promise<SubtreeAvailability> => {
      const key = `${level}/${coords.join("/")}`;
      let avail = opts.subtreeCache.get(key);
      if (!avail) {
        const url = opts.resolveUrl(templateUri(spec.subtreeTemplate, level, coords), node.baseUri);
        const buffer = await opts.fetchArrayBuffer(url);
        avail = await parseSubtree(buffer, sub.branch, bufUri => opts.fetchArrayBuffer(opts.resolveUrl(bufUri, dirOf(url))));
        opts.subtreeCache.set(key, avail);
      }
      return avail;
    };

    const emitContent = (globalLevel: number, coords: number[], center: Vec3, radius: number): void => {
      if (!spec.contentTemplate) return;
      out.push({
        id: `${node.id}-imp-${globalLevel}-${coords.join("-")}`,
        worldMatrix: node.worldMatrix,
        geometricError: geometricErrorAtLevel(node.geometricError, globalLevel),
        refine: node.refine,
        contentUri: templateUri(spec.contentTemplate, globalLevel, coords),
        baseUri: node.baseUri,
        center,
        radius,
        children: [],
      });
    };

    const walk = async (
      avail: SubtreeAvailability,
      localLevel: number,
      morton: number,
      globalLevel: number,
      coords: number[],
    ): Promise<void> => {
      if (!avail.isTileAvailable(localLevel, morton)) return;
      const {center, radius} = subdividedSphere(spec.rootBox, dims, globalLevel, coords, node.worldMatrix);
      if (culled(center, radius)) return;

      const atDeepest = globalLevel >= spec.availableLevels - 1;
      const refine =
        !atDeepest &&
        sseAt(geometricErrorAtLevel(node.geometricError, globalLevel), center, radius) > opts.maxScreenSpaceError;

      const childLocalLevel = localLevel + 1;
      const children: {morton: number; coords: number[]; viaChildSubtree: boolean}[] = [];
      if (refine) {
        for (let c = 0; c < sub.branch; c++) {
          const childMorton = (morton << dims) | c;
          const childCoords = coords.map((v, axis) => v * 2 + ((c >> axis) & 1));
          if (childLocalLevel < spec.subtreeLevels) {
            if (avail.isTileAvailable(childLocalLevel, childMorton)) {
              children.push({morton: childMorton, coords: childCoords, viaChildSubtree: false});
            }
          } else if (avail.isChildSubtreeAvailable(childMorton)) {
            children.push({morton: childMorton, coords: childCoords, viaChildSubtree: true});
          }
        }
      }

      // REPLACE renders only where it stops refining (no available children or
      // good enough); ADD renders at every available level it visits.
      if (node.refine === "ADD") {
        if (avail.isContentAvailable(localLevel, morton)) emitContent(globalLevel, coords, center, radius);
      } else if (children.length === 0) {
        if (avail.isContentAvailable(localLevel, morton)) emitContent(globalLevel, coords, center, radius);
      }

      for (const child of children) {
        if (child.viaChildSubtree) {
          const childAvail = await subtreeFor(globalLevel + 1, child.coords);
          await walk(childAvail, 0, 0, globalLevel + 1, child.coords);
        } else {
          await walk(avail, childLocalLevel, child.morton, globalLevel + 1, child.coords);
        }
      }
    };

    const origin = new Array(dims).fill(0);
    const rootAvail = await subtreeFor(0, origin);
    await walk(rootAvail, 0, 0, 0, origin);
  };

  await visit(root);
  return out;
}
