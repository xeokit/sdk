import type {Mat4} from "../../../../../base/math/matrix";
import type {View} from "../../../../viewer";
import type {MemoryConfigs} from "../../MemoryConfigs";
import type {TriangleBatchSegment, TriangleBatchSet} from "../gpuMemoryManager";
import {MeshManager, type RendererMesh} from "../meshManager";
import type {DrawItem, RenderBins} from "../renderState";

const IDENTITY_MATRIX: ReadonlyArray<number> = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const MIN_CLIP_W = 1e-6;

export interface RenderCullStats {
  considered: number;
  rendered: number;
  frustumCulled: number;
  projectedSizeCulled: number;
  segmentCandidates: number;
  segmentFrustumCulled: number;
  segmentFullyDrawn: number;
  segmentPartiallyRefined: number;
}

/**
 * Sorts WebGPU mesh states into per-frame render bins.
 *
 * @internal
 */
export class RenderBinClassifier {

  private readonly _drawItemPool: DrawItem[] = [];
  private readonly _viewPoint = [0, 0, 0];
  private readonly _clipPoint = [0, 0, 0, 1];
  private readonly _stats: RenderCullStats = createEmptyCullStats();
  private readonly _memoryConfigs: MemoryConfigs;
  private _drawItemPoolCount = 0;

  constructor(memoryConfigs: MemoryConfigs) {
    this._memoryConfigs = memoryConfigs;
  }

  public get stats(): RenderCullStats {
    return this._stats;
  }

  public clear(bins: RenderBins): void {
    bins.normalDrawOpaque.length = 0;
    bins.normalEdgesOpaque.length = 0;
    bins.normalFillTransparent.length = 0;
    bins.xrayedFillOpaque.length = 0;
    bins.xrayedEdgesOpaque.length = 0;
    bins.xrayedFillTransparent.length = 0;
    bins.xrayedEdgesTransparent.length = 0;
    bins.highlightedFillOpaque.length = 0;
    bins.highlightedEdgesOpaque.length = 0;
    bins.highlightedFillTransparent.length = 0;
    bins.highlightedEdgesTransparent.length = 0;
    bins.selectedFillOpaque.length = 0;
    bins.selectedEdgesOpaque.length = 0;
    bins.selectedFillTransparent.length = 0;
    bins.selectedEdgesTransparent.length = 0;
    this._drawItemPoolCount = 0;
    resetCullStats(this._stats);
  }

  public classify(params: {
    meshStates: ReadonlyArray<RendererMesh>;
    view: View;
    meshManager: MeshManager;
    bins: RenderBins;
  }): void {
    const {meshStates, view, meshManager, bins} = params;

    for (const meshState of meshStates) {
      this._classifyMesh(meshState, view, meshManager, bins);
    }

    bins.normalFillTransparent.sort((a, b) => a.viewDepth - b.viewDepth);
    this._sortTransparentEmphasisBins(bins);
  }

  public classifySegments(params: {
    batchSet: TriangleBatchSet;
    view: View;
    meshManager: MeshManager;
    bins: RenderBins;
    cameraCulling?: boolean;
  }): void {
    const {batchSet, view, meshManager, bins} = params;
    const cameraCulling = params.cameraCulling ?? true;

    for (let segmentIndex = 0, segmentLen = batchSet.segments.length; segmentIndex < segmentLen; segmentIndex++) {
      const segment = batchSet.segments[segmentIndex];
      this._stats.segmentCandidates++;
      if (meshManager.isLODRepMembershipSuppressedInView(segment.lodRepMemberships, view)) {
        continue;
      }
      let segmentClipBounds: ReturnType<RenderBinClassifier["_getWorldAABBClipBounds"]> | null = null;
      if (cameraCulling) {
        this._updateSegmentWorldAABB(segment, meshManager);
        segmentClipBounds = this._getWorldAABBClipBounds(segment.worldAABB, view);

        if (this._memoryConfigs.frustumCulling && segmentClipBounds && this._isOutsideFrustum(segmentClipBounds)) {
          this._stats.segmentFrustumCulled++;
          this._stats.frustumCulled += segment.slots.length;
          continue;
        }
        if (
          this._memoryConfigs.minProjectedCanvasSize > 0 &&
          segmentClipBounds &&
          this._isBelowProjectedCanvasSize(segmentClipBounds, view, this._memoryConfigs.minProjectedCanvasSize)
        ) {
          this._stats.projectedSizeCulled += segment.slots.length;
          continue;
        }
      }

      if ((!cameraCulling || !segmentClipBounds || segmentClipBounds.allInsideFrustum) && this._tryAppendFullOpaqueSegment({segment, view, meshManager, bins})) {
        this._stats.segmentFullyDrawn++;
        continue;
      }

      this._stats.segmentPartiallyRefined++;
      for (let i = 0, len = segment.slots.length; i < len; i++) {
        this._classifyMesh(segment.slots[i].meshState, view, meshManager, bins, cameraCulling);
      }
    }

    bins.normalFillTransparent.sort((a, b) => a.viewDepth - b.viewDepth);
    this._sortTransparentEmphasisBins(bins);
  }

  private _classifyMesh(meshState: RendererMesh, view: View, meshManager: MeshManager, bins: RenderBins, cameraCulling = false): void {
    if (meshState.mesh.bin === "overlayPicker") {
      return;
    }
    if (!meshManager.isMeshVisibleInView(meshState, view)) {
      return;
    }
    if (cameraCulling && !this._isMeshInCameraView(meshState, view, meshManager)) {
      return;
    }

    const opacity = meshManager.getMeshOpacityInView(meshState, view);
    if (opacity <= 0) {
      return;
    }

    this._stats.considered++;
    this._appendDrawItem(meshState, opacity, view, meshManager, bins);
  }

  private _tryAppendFullOpaqueSegment(params: {
    segment: TriangleBatchSegment;
    view: View;
    meshManager: MeshManager;
    bins: RenderBins;
  }): boolean {
    const {segment, view, meshManager, bins} = params;
    for (let i = 0, len = segment.slots.length; i < len; i++) {
      const meshState = segment.slots[i].meshState;
      if (meshState.mesh.bin === "overlayPicker") {
        return false;
      }
      if (!meshManager.isMeshVisibleInView(meshState, view)) {
        return false;
      }
      const style = meshManager.getMeshDrawStyleInView(meshState, view);
      if (style.opacity < 1 || style.alphaMode === 2) {
        return false;
      }
    }

    for (let i = 0, len = segment.slots.length; i < len; i++) {
      this._stats.considered++;
      this._appendDrawItem(segment.slots[i].meshState, 1, view, meshManager, bins);
    }
    return true;
  }

  private _appendDrawItem(meshState: RendererMesh, opacity: number, view: View, meshManager: MeshManager, bins: RenderBins): void {
    const drawItem = this._nextDrawItem();
    drawItem.meshState = meshState;
    drawItem.opacity = opacity;
    this._stats.rendered++;
    const style = meshManager.getMeshDrawStyleInView(meshState, view);
    const isOpaque = opacity >= 1 && style.alphaMode !== 2;
    const hasEdges = style.drawEdges && meshState.geometryState.edgeIndexCount > 0;

    if (isOpaque) {
      drawItem.viewDepth = 0;
    } else {
      drawItem.viewDepth = meshManager.getMeshViewDepth(meshState, view);
    }

    switch (style.emphasis) {
      case "xrayed":
        (isOpaque ? bins.xrayedFillOpaque : bins.xrayedFillTransparent).push(drawItem);
        if (hasEdges) {
          (isOpaque ? bins.xrayedEdgesOpaque : bins.xrayedEdgesTransparent).push(drawItem);
        }
        break;
      case "highlighted":
        (isOpaque ? bins.highlightedFillOpaque : bins.highlightedFillTransparent).push(drawItem);
        if (hasEdges) {
          (isOpaque ? bins.highlightedEdgesOpaque : bins.highlightedEdgesTransparent).push(drawItem);
        }
        break;
      case "selected":
        (isOpaque ? bins.selectedFillOpaque : bins.selectedFillTransparent).push(drawItem);
        if (hasEdges) {
          (isOpaque ? bins.selectedEdgesOpaque : bins.selectedEdgesTransparent).push(drawItem);
        }
        break;
      default:
        (isOpaque ? bins.normalDrawOpaque : bins.normalFillTransparent).push(drawItem);
        if (isOpaque && hasEdges) {
          bins.normalEdgesOpaque.push(drawItem);
        }
        break;
      }
  }

  private _sortTransparentEmphasisBins(bins: RenderBins): void {
    bins.xrayedFillTransparent.sort((a, b) => a.viewDepth - b.viewDepth);
    bins.xrayedEdgesTransparent.sort((a, b) => a.viewDepth - b.viewDepth);
    bins.highlightedFillTransparent.sort((a, b) => a.viewDepth - b.viewDepth);
    bins.highlightedEdgesTransparent.sort((a, b) => a.viewDepth - b.viewDepth);
    bins.selectedFillTransparent.sort((a, b) => a.viewDepth - b.viewDepth);
    bins.selectedEdgesTransparent.sort((a, b) => a.viewDepth - b.viewDepth);
  }

  private _isMeshInCameraView(meshState: RendererMesh, view: View, meshManager: MeshManager): boolean {
    const meshClipBounds = this._getMeshWorldAABBClipBounds(meshState, view, meshManager);
    if (!meshClipBounds) {
      return true;
    }
    if (this._memoryConfigs.frustumCulling && this._isOutsideFrustum(meshClipBounds)) {
      this._stats.frustumCulled++;
      return false;
    }
    if (
      this._memoryConfigs.minProjectedCanvasSize > 0 &&
      this._isBelowProjectedCanvasSize(meshClipBounds, view, this._memoryConfigs.minProjectedCanvasSize)
    ) {
      this._stats.projectedSizeCulled++;
      return false;
    }
    return true;
  }

  private _nextDrawItem(): DrawItem {
    let drawItem = this._drawItemPool[this._drawItemPoolCount];
    if (!drawItem) {
      drawItem = {
        meshState: null as any,
        opacity: 1,
        viewDepth: 0
      };
      this._drawItemPool.push(drawItem);
    }
    this._drawItemPoolCount++;
    return drawItem;
  }

  private _getWorldAABBClipBounds(worldAABB: ArrayLike<number>, view: View): ClipBounds | null {
    if (!Number.isFinite(worldAABB[0]) || !Number.isFinite(worldAABB[3])) {
      return null;
    }

    const viewMatrix = (view.camera?.viewMatrix ?? IDENTITY_MATRIX) as Mat4;
    const projectionMatrix = (view.camera?.projMatrix ?? IDENTITY_MATRIX) as Mat4;
    const bounds = createClipBounds();

    for (let xIndex = 0; xIndex < 2; xIndex++) {
      const x = worldAABB[xIndex === 0 ? 0 : 3];
      for (let yIndex = 0; yIndex < 2; yIndex++) {
        const y = worldAABB[yIndex === 0 ? 1 : 4];
        for (let zIndex = 0; zIndex < 2; zIndex++) {
          const z = worldAABB[zIndex === 0 ? 2 : 5];
          this._projectWorldPoint(viewMatrix, projectionMatrix, x, y, z);
          growClipBounds(bounds, this._clipPoint);
        }
      }
    }

    return bounds.valid ? bounds : null;
  }

  private _getMeshWorldAABBClipBounds(meshState: RendererMesh, view: View, meshManager: MeshManager): ClipBounds | null {
    const localAABB = meshState.geometryState.geometry.aabb;
    if (!localAABB) {
      return null;
    }
    const worldMatrix = meshManager.getMeshWorldMatrix(meshState);
    const viewMatrix = (view.camera?.viewMatrix ?? IDENTITY_MATRIX) as Mat4;
    const projectionMatrix = (view.camera?.projMatrix ?? IDENTITY_MATRIX) as Mat4;
    const bounds = createClipBounds();

    for (let xIndex = 0; xIndex < 2; xIndex++) {
      const x = localAABB[xIndex === 0 ? 0 : 3];
      for (let yIndex = 0; yIndex < 2; yIndex++) {
        const y = localAABB[yIndex === 0 ? 1 : 4];
        for (let zIndex = 0; zIndex < 2; zIndex++) {
          const z = localAABB[zIndex === 0 ? 2 : 5];
          const worldX = worldMatrix[0] * x + worldMatrix[4] * y + worldMatrix[8] * z + worldMatrix[12];
          const worldY = worldMatrix[1] * x + worldMatrix[5] * y + worldMatrix[9] * z + worldMatrix[13];
          const worldZ = worldMatrix[2] * x + worldMatrix[6] * y + worldMatrix[10] * z + worldMatrix[14];
          this._projectWorldPoint(viewMatrix, projectionMatrix, worldX, worldY, worldZ);
          growClipBounds(bounds, this._clipPoint);
        }
      }
    }

    return bounds.valid ? bounds : null;
  }

  private _updateSegmentWorldAABB(segment: TriangleBatchSegment, meshManager: MeshManager): void {
    const boundsVersion = getSegmentBoundsVersion(segment);
    if (segment.boundsVersion === boundsVersion) {
      return;
    }

    resetAABB(segment.worldAABB);
    for (let i = 0, len = segment.slots.length; i < len; i++) {
      const meshState = segment.slots[i].meshState;
      expandWorldAABB(segment.worldAABB, meshState.geometryState.geometry.aabb, meshManager.getMeshWorldMatrix(meshState));
    }
    segment.boundsVersion = boundsVersion;
  }

  private _projectWorldPoint(
    viewMatrix: Mat4,
    projectionMatrix: Mat4,
    worldX: number,
    worldY: number,
    worldZ: number
  ): void {
    const viewPoint = this._viewPoint;
    viewPoint[0] = viewMatrix[0] * worldX + viewMatrix[4] * worldY + viewMatrix[8] * worldZ + viewMatrix[12];
    viewPoint[1] = viewMatrix[1] * worldX + viewMatrix[5] * worldY + viewMatrix[9] * worldZ + viewMatrix[13];
    viewPoint[2] = viewMatrix[2] * worldX + viewMatrix[6] * worldY + viewMatrix[10] * worldZ + viewMatrix[14];

    const clipPoint = this._clipPoint;
    clipPoint[0] = projectionMatrix[0] * viewPoint[0] + projectionMatrix[4] * viewPoint[1] + projectionMatrix[8] * viewPoint[2] + projectionMatrix[12];
    clipPoint[1] = projectionMatrix[1] * viewPoint[0] + projectionMatrix[5] * viewPoint[1] + projectionMatrix[9] * viewPoint[2] + projectionMatrix[13];
    clipPoint[2] = projectionMatrix[2] * viewPoint[0] + projectionMatrix[6] * viewPoint[1] + projectionMatrix[10] * viewPoint[2] + projectionMatrix[14];
    clipPoint[3] = projectionMatrix[3] * viewPoint[0] + projectionMatrix[7] * viewPoint[1] + projectionMatrix[11] * viewPoint[2] + projectionMatrix[15];
  }

  private _isOutsideFrustum(bounds: ClipBounds): boolean {
    return (
      bounds.maxX < -bounds.maxW ||
      bounds.minX > bounds.maxW ||
      bounds.maxY < -bounds.maxW ||
      bounds.minY > bounds.maxW ||
      bounds.maxZ < -bounds.maxW ||
      bounds.minZ > bounds.maxW
    );
  }

  private _isBelowProjectedCanvasSize(bounds: ClipBounds, view: View, threshold: number): boolean {
    if (!Number.isFinite(bounds.minNdcX) || !Number.isFinite(bounds.maxNdcX)) {
      return false;
    }
    const width = Math.max(0, Math.floor(view.boundary?.[2] ?? view.htmlElement?.clientWidth ?? 0));
    const height = Math.max(0, Math.floor(view.boundary?.[3] ?? view.htmlElement?.clientHeight ?? 0));
    if (width <= 0 || height <= 0) {
      return false;
    }

    const projectedWidth = Math.max(0, (bounds.maxNdcX - bounds.minNdcX) * 0.5 * width);
    const projectedHeight = Math.max(0, (bounds.maxNdcY - bounds.minNdcY) * 0.5 * height);
    return Math.max(projectedWidth, projectedHeight) < threshold;
  }
}

interface ClipBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  maxW: number;
  minNdcX: number;
  maxNdcX: number;
  minNdcY: number;
  maxNdcY: number;
  allInsideFrustum: boolean;
  valid: boolean;
}

function createEmptyCullStats(): RenderCullStats {
  return {
    considered: 0,
    rendered: 0,
    frustumCulled: 0,
    projectedSizeCulled: 0,
    segmentCandidates: 0,
    segmentFrustumCulled: 0,
    segmentFullyDrawn: 0,
    segmentPartiallyRefined: 0
  };
}

function resetCullStats(stats: RenderCullStats): void {
  stats.considered = 0;
  stats.rendered = 0;
  stats.frustumCulled = 0;
  stats.projectedSizeCulled = 0;
  stats.segmentCandidates = 0;
  stats.segmentFrustumCulled = 0;
  stats.segmentFullyDrawn = 0;
  stats.segmentPartiallyRefined = 0;
}

function createClipBounds(): ClipBounds {
  return {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
    maxW: 0,
    minNdcX: Number.POSITIVE_INFINITY,
    maxNdcX: Number.NEGATIVE_INFINITY,
    minNdcY: Number.POSITIVE_INFINITY,
    maxNdcY: Number.NEGATIVE_INFINITY,
    allInsideFrustum: true,
    valid: false
  };
}

function growClipBounds(bounds: ClipBounds, point: ReadonlyArray<number>): void {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const w = Math.abs(point[3]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(w)) {
    return;
  }

  bounds.minX = Math.min(bounds.minX, x);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxZ = Math.max(bounds.maxZ, z);
  bounds.maxW = Math.max(bounds.maxW, w);
  bounds.valid = true;

  if (w > MIN_CLIP_W) {
    const ndcX = x / w;
    const ndcY = y / w;
    bounds.minNdcX = Math.min(bounds.minNdcX, ndcX);
    bounds.maxNdcX = Math.max(bounds.maxNdcX, ndcX);
    bounds.minNdcY = Math.min(bounds.minNdcY, ndcY);
    bounds.maxNdcY = Math.max(bounds.maxNdcY, ndcY);
  }
  if (
    w <= MIN_CLIP_W ||
    x < -w ||
    x > w ||
    y < -w ||
    y > w ||
    z < -w ||
    z > w
  ) {
    bounds.allInsideFrustum = false;
  }
}

function getSegmentBoundsVersion(segment: TriangleBatchSegment): string {
  const parts: string[] = [];
  for (let i = 0, len = segment.slots.length; i < len; i++) {
    const meshState = segment.slots[i].meshState;
    parts.push(`${meshState.mesh.uniqueId}:${meshState.instanceDataVersion}`);
  }
  return parts.join("|");
}

function resetAABB(aabb: Float64Array): void {
  aabb[0] = Number.POSITIVE_INFINITY;
  aabb[1] = Number.POSITIVE_INFINITY;
  aabb[2] = Number.POSITIVE_INFINITY;
  aabb[3] = Number.NEGATIVE_INFINITY;
  aabb[4] = Number.NEGATIVE_INFINITY;
  aabb[5] = Number.NEGATIVE_INFINITY;
}

function expandWorldAABB(worldAABB: Float64Array, localAABB: ArrayLike<number> | undefined, worldMatrix: ArrayLike<number>): void {
  if (!localAABB) {
    return;
  }
  for (let xIndex = 0; xIndex < 2; xIndex++) {
    const x = localAABB[xIndex === 0 ? 0 : 3];
    for (let yIndex = 0; yIndex < 2; yIndex++) {
      const y = localAABB[yIndex === 0 ? 1 : 4];
      for (let zIndex = 0; zIndex < 2; zIndex++) {
        const z = localAABB[zIndex === 0 ? 2 : 5];
        const worldX = worldMatrix[0] * x + worldMatrix[4] * y + worldMatrix[8] * z + worldMatrix[12];
        const worldY = worldMatrix[1] * x + worldMatrix[5] * y + worldMatrix[9] * z + worldMatrix[13];
        const worldZ = worldMatrix[2] * x + worldMatrix[6] * y + worldMatrix[10] * z + worldMatrix[14];
        worldAABB[0] = Math.min(worldAABB[0], worldX);
        worldAABB[1] = Math.min(worldAABB[1], worldY);
        worldAABB[2] = Math.min(worldAABB[2], worldZ);
        worldAABB[3] = Math.max(worldAABB[3], worldX);
        worldAABB[4] = Math.max(worldAABB[4], worldY);
        worldAABB[5] = Math.max(worldAABB[5], worldZ);
      }
    }
  }
}
