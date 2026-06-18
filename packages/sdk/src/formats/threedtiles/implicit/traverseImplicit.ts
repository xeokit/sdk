/**
 * Walks a 3D Tiles 1.1 implicit-tiling structure: fetches `.subtree` files,
 * enumerates available tiles by Morton index, templates each tile's global
 * coordinates into the content and subtree URIs, and loads the selected tiles'
 * content. Implicit tiles have no per-tile transform — they inherit the
 * implicit-root tile's transform, which is passed through unchanged.
 *
 * Tile selection mirrors explicit traversal: `REPLACE` loads content at tiles
 * with no available children; `ADD` loads at every available tile. `maxDepth`
 * and the tileset's `availableLevels` bound descent.
 */

import type {Mat4} from "../../../base/math/matrix";
import {parseSubtree, type SubtreeAvailability} from "./parseSubtree";
import {subdivisionOf} from "./morton";

export interface ImplicitTraversalParams {
  implicitTiling: any;
  contentTemplate: string | undefined;
  worldMatrix: Mat4;
  refine: string;
  baseUri: string | undefined;
  maxDepth?: number;
  signal?: AbortSignal;
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  resolveUrl: (uri: string, baseUri: string | undefined) => string;
  loadContent: (uri: string, baseUri: string | undefined, worldMatrix: Mat4) => Promise<void>;
}

export async function traverseImplicit(p: ImplicitTraversalParams): Promise<void> {
  const sub = subdivisionOf(p.implicitTiling.subdivisionScheme);
  const subtreeLevels: number = p.implicitTiling.subtreeLevels;
  const availableLevels: number =
    p.implicitTiling.availableLevels ?? ((p.implicitTiling.maximumLevel ?? Infinity) + 1);
  const subtreeTemplate: string = p.implicitTiling.subtrees.uri;
  const dims = sub.dims;

  const fetchSubtree = async (level: number, coords: number[]): Promise<SubtreeAvailability> => {
    const url = p.resolveUrl(templateUri(subtreeTemplate, level, coords), p.baseUri);
    const buffer = await p.fetchArrayBuffer(url);
    return parseSubtree(buffer, sub.branch, (bufUri) => p.fetchArrayBuffer(p.resolveUrl(bufUri, dirOf(url))));
  };

  const walk = async (
    avail: SubtreeAvailability,
    localLevel: number,
    morton: number,
    globalLevel: number,
    coords: number[],
  ): Promise<void> => {
    if (p.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (!avail.isTileAvailable(localLevel, morton)) return;

    const atDepthCap =
      (p.maxDepth != null && globalLevel >= p.maxDepth) || globalLevel >= availableLevels - 1;

    const childLocalLevel = localLevel + 1;
    const children: {morton: number; coords: number[]; viaChildSubtree: boolean}[] = [];
    if (!atDepthCap) {
      for (let c = 0; c < sub.branch; c++) {
        const childMorton = (morton << dims) | c;
        const childCoords = coords.map((v, axis) => v * 2 + ((c >> axis) & 1));
        if (childLocalLevel < subtreeLevels) {
          if (avail.isTileAvailable(childLocalLevel, childMorton)) {
            children.push({morton: childMorton, coords: childCoords, viaChildSubtree: false});
          }
        } else if (avail.isChildSubtreeAvailable(childMorton)) {
          children.push({morton: childMorton, coords: childCoords, viaChildSubtree: true});
        }
      }
    }

    const loadHere = p.refine === "ADD" || children.length === 0 || atDepthCap;
    if (loadHere && p.contentTemplate && avail.isContentAvailable(localLevel, morton)) {
      await p.loadContent(templateUri(p.contentTemplate, globalLevel, coords), p.baseUri, p.worldMatrix);
    }

    for (const child of children) {
      if (child.viaChildSubtree) {
        const childAvail = await fetchSubtree(globalLevel + 1, child.coords);
        await walk(childAvail, 0, 0, globalLevel + 1, child.coords);
      } else {
        await walk(avail, childLocalLevel, child.morton, globalLevel + 1, child.coords);
      }
    }
  };

  const origin = new Array(dims).fill(0);
  const root = await fetchSubtree(0, origin);
  await walk(root, 0, 0, 0, origin);
}

export function templateUri(template: string, level: number, coords: number[]): string {
  return template
    .replace(/\{level\}/g, String(level))
    .replace(/\{x\}/g, String(coords[0]))
    .replace(/\{y\}/g, String(coords[1]))
    .replace(/\{z\}/g, String(coords[2] ?? 0));
}

export function dirOf(url: string): string {
  const i = url.lastIndexOf("/");
  return i >= 0 ? url.slice(0, i + 1) : url;
}
