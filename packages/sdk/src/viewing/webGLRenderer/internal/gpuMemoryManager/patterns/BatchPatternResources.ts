import type {SceneGeometry, SceneMaterial, SceneMesh} from "../../../../../model/scene";
import {LinesPrimitive} from "../../../../../base/constants";
import {type SDKResult} from "../../../../../base/core";
import {GeometryAttributeTexture} from "../dataTextures/GeometryAttributeTexture";
import {HatchPatternTexture} from "../dataTextures/HatchPatternTexture";
import {LinePatternTexture} from "../dataTextures/LinePatternTexture";
import {PolylineCumDistTexture} from "../dataTextures/PolylineCumDistTexture";
import type {PortionHandle} from "../dataTextures/PortionDataTexture";

/**
 * Maximum number of distinct line-pattern slots a single batch can carry.
 *
 * Each slot consumes 2 RGBA32UI texels (= 32 bytes). Slots are allocated
 * lazily for materials whose line pattern is not the default solid line.
 *
 * @internal
 */
export const MAX_LINE_PATTERN_SLOTS = 256;

/**
 * Maximum number of distinct hatch-pattern slots a single batch can carry.
 *
 * Each slot consumes 10 RGBA32F texels (= 160 bytes). Slot 0 is reserved as
 * the "no hatch" sentinel, so real material slots start at 1.
 *
 * @internal
 */
export const MAX_HATCH_PATTERN_SLOTS = 256;

const EMPTY_LINE_PATTERN_ENTRIES = new Float32Array(8);
const EMPTY_HATCH_FAMILIES = new Float32Array(4 * 4);
const EMPTY_HATCH_COLOR = new Float32Array(4);

type BatchPatternResourcesOptions = {
  gl: WebGL2RenderingContext;
  batchIndex: number;
  maxBatchIndices: number;
};

/**
 * Pattern textures exposed through a batch's public renderer resource bag.
 *
 * @internal
 */
export type BatchPatternTextureResources = {
  linePatternTexture: LinePatternTexture;
  hatchPatternTexture: HatchPatternTexture;
  polylineCumDistTexture: PolylineCumDistTexture;
};

/**
 * Portion allocated in the polyline cumulative-distance texture for one line geometry.
 *
 * @internal
 */
export type BatchPolylineCumDistHandle = PortionHandle;

/**
 * Pattern slot indices that get written into MeshAttributeTexture.
 *
 * @internal
 */
export type BatchMeshPatternSlots = {
  linePatternSlot: number;
  hatchPatternSlot: number;
};

/**
 * Owns the per-batch line, hatch, and polyline-distance resources.
 *
 * GPUMemoryBatch decides when geometries and meshes enter or leave a batch.
 * This class owns the pattern textures and their slot allocators, including
 * material-pattern edits and the per-line-segment cumulative-distance portions
 * used by thick-line dash phase continuity.
 *
 * @internal
 */
export class BatchPatternResources {

  private _linePatternTexture: LinePatternTexture | null;
  private _hatchPatternTexture: HatchPatternTexture | null;
  private _polylineCumDistTexture: PolylineCumDistTexture | null;
  private _linePatternSlotsByMaterial: Map<string, number>;
  private _hatchPatternSlotsByMaterial: Map<string, number>;
  private _nextLinePatternSlot: number;
  private _nextHatchPatternSlot: number;

  constructor(options: BatchPatternResourcesOptions) {
    const {gl, batchIndex, maxBatchIndices} = options;
    this._linePatternSlotsByMaterial = new Map();
    this._hatchPatternSlotsByMaterial = new Map();
    this._nextLinePatternSlot = 1;
    this._nextHatchPatternSlot = 1;

    // Eager allocation gives every shader sampler a valid texture binding.
    // WebGL2 rejects draws when a sampler points at an unbound or wrong-typed
    // texture unit, even when the current material does not use that sampler.
    this._linePatternTexture = new LinePatternTexture({
      gl,
      maxItems: MAX_LINE_PATTERN_SLOTS,
      description: `[Batch ${batchIndex}] - lineMaterialSlot -> 8 pattern entries`,
      getNumItems: () => this._nextLinePatternSlot,
    });
    this._hatchPatternTexture = new HatchPatternTexture({
      gl,
      maxItems: MAX_HATCH_PATTERN_SLOTS,
      description: `[Batch ${batchIndex}] - hatchMaterialSlot -> 4 line families + RGBA colour + flags`,
      getNumItems: () => this._nextHatchPatternSlot,
    });
    this._polylineCumDistTexture = new PolylineCumDistTexture({
      gl,
      maxItems: Math.max(1, Math.floor(maxBatchIndices / 2)),
      description: `[Batch ${batchIndex}] - per-segment cumulative model distance from polyline start`,
    });
  }

  /**
   * Returns resources that participate in normal batch allocation rollback.
   */
  getAllocatableResources(): Array<LinePatternTexture | HatchPatternTexture | PolylineCumDistTexture> {
    return this._getPatternTextures();
  }

  /**
   * Returns the pattern fields to flatten into BatchGPUResources.
   */
  getDataTextureResources(): BatchPatternTextureResources {
    return {
      linePatternTexture: this._linePatternTexture!,
      hatchPatternTexture: this._hatchPatternTexture!,
      polylineCumDistTexture: this._polylineCumDistTexture!
    };
  }

  /**
   * Allocates cumulative line-distance data for one LinesPrimitive geometry.
   *
   * Allocation failure is a quiet downgrade: the geometry's
   * `polylineCumDistBase` remains 0 and dash phase restarts at each segment,
   * matching the older non-polyline-aware behavior.
   */
  allocatePolylineCumDist(
    sceneGeometry: SceneGeometry,
    geometryIndex: number,
    geometryAttributeTexture: GeometryAttributeTexture
  ): BatchPolylineCumDistHandle | null {
    if (!this._polylineCumDistTexture
      || sceneGeometry.primitive !== LinesPrimitive
      || !sceneGeometry.indices
      || !sceneGeometry.aabb) {
      return null;
    }
    const cumDistData = computePolylineCumDist(
      sceneGeometry.indices,
      sceneGeometry.positionsCompressed,
      sceneGeometry.aabb,
    );
    if (cumDistData.length === 0) {
      return null;
    }
    return this._polylineCumDistTexture.getPortion(
      cumDistData,
      (newBase: number) => {
        geometryAttributeTexture.setItem(geometryIndex, {
          polylineCumDistBase: newBase
        });
      }
    );
  }

  /**
   * Returns a previously allocated polyline-distance portion to the texture.
   */
  freePolylineCumDistHandle(handle: BatchPolylineCumDistHandle | null): void {
    if (handle && this._polylineCumDistTexture) {
      this._polylineCumDistTexture.putPortion(handle);
    }
  }

  /**
   * Resolves the line and hatch slots for a mesh's effective material state.
   */
  resolveMeshPatternSlots(sceneMesh: SceneMesh): BatchMeshPatternSlots {
    return {
      linePatternSlot: this._allocateLinePatternSlot(sceneMesh),
      hatchPatternSlot: this._allocateHatchPatternSlot(sceneMesh)
    };
  }

  /**
   * Re-encodes any pattern slots held for the supplied material.
   */
  updateMaterialPattern(material: SceneMaterial): boolean {
    const key = material.uniqueId;
    let updated = false;
    const lineSlot = this._linePatternSlotsByMaterial.get(key);
    if (lineSlot !== undefined && this._linePatternTexture) {
      const entries = material._linePatternEntries;
      const len = material._linePatternLen;
      if (len > 0) {
        this._linePatternTexture.setSlot(lineSlot, entries);
      } else {
        this._linePatternTexture.setSlot(lineSlot, EMPTY_LINE_PATTERN_ENTRIES);
      }
      updated = true;
    }
    const hatchSlot = this._hatchPatternSlotsByMaterial.get(key);
    if (hatchSlot !== undefined && this._hatchPatternTexture) {
      const families = material._hatchPatternFamilies;
      const color = material._hatchPatternColor;
      const count = material._hatchPatternCount;
      const space = material._hatchPatternSpace;
      if (count > 0) {
        this._hatchPatternTexture.setSlot(hatchSlot, families, color, space);
      } else {
        this._hatchPatternTexture.setSlot(hatchSlot, EMPTY_HATCH_FAMILIES, EMPTY_HATCH_COLOR, 0);
      }
      updated = true;
    }
    return updated;
  }

  uploadChanges(): boolean {
    let didFlush = false;
    if (this._linePatternTexture) {
      didFlush = this._linePatternTexture.uploadChanges() || didFlush;
    }
    if (this._hatchPatternTexture) {
      didFlush = this._hatchPatternTexture.uploadChanges() || didFlush;
    }
    if (this._polylineCumDistTexture) {
      didFlush = this._polylineCumDistTexture.uploadChanges() || didFlush;
    }
    return didFlush;
  }

  webglContextRestored(gl: WebGL2RenderingContext): SDKResult<void> {
    for (const texture of this._getPatternTextures()) {
      texture.setWebGLContext(gl);
      const result = texture.webglContextRestored();
      if (result.ok === false) {
        return result;
      }
    }
    return {ok: true, value: undefined};
  }

  getAllocatedBytes(): number {
    let total = 0;
    for (const texture of this._getPatternTextures()) {
      total += texture.getAllocatedBytes();
    }
    return total;
  }

  getUsedBytes(): number {
    let total = 0;
    for (const texture of this._getPatternTextures()) {
      total += texture.getUsedBytes();
    }
    return total;
  }

  destroy(): void {
    this._linePatternTexture = this._clearTexture(this._linePatternTexture);
    this._hatchPatternTexture = this._clearTexture(this._hatchPatternTexture);
    this._polylineCumDistTexture = this._clearTexture(this._polylineCumDistTexture);
    this._linePatternSlotsByMaterial.clear();
    this._hatchPatternSlotsByMaterial.clear();
    this._nextLinePatternSlot = 1;
    this._nextHatchPatternSlot = 1;
  }

  private _allocateLinePatternSlot(sceneMesh: SceneMesh): number {
    const len = sceneMesh.effectiveLinePatternLen;
    if (len === 0) {
      return 0;
    }
    const entries = sceneMesh.effectiveLinePatternEntries;
    const material = sceneMesh.material;
    if (!entries || !material) {
      return 0;
    }
    const key = material.uniqueId;
    const existing = this._linePatternSlotsByMaterial.get(key);
    if (existing !== undefined) {
      return existing;
    }
    if (this._nextLinePatternSlot >= MAX_LINE_PATTERN_SLOTS) {
      return 0;
    }
    const slot = this._nextLinePatternSlot++;
    this._linePatternTexture!.setSlot(slot, entries);
    this._linePatternSlotsByMaterial.set(key, slot);
    return slot;
  }

  private _allocateHatchPatternSlot(sceneMesh: SceneMesh): number {
    const count = sceneMesh.effectiveHatchPatternCount;
    if (count === 0) {
      return 0;
    }
    const families = sceneMesh.effectiveHatchPatternFamilies;
    const color = sceneMesh.effectiveHatchPatternColor;
    const material = sceneMesh.material;
    if (!families || !color || !material) {
      return 0;
    }
    const key = material.uniqueId;
    const existing = this._hatchPatternSlotsByMaterial.get(key);
    if (existing !== undefined) {
      return existing;
    }
    if (this._nextHatchPatternSlot >= MAX_HATCH_PATTERN_SLOTS) {
      return 0;
    }
    const slot = this._nextHatchPatternSlot++;
    this._hatchPatternTexture!.setSlot(slot, families, color, sceneMesh.effectiveHatchPatternSpace);
    this._hatchPatternSlotsByMaterial.set(key, slot);
    return slot;
  }

  private _getPatternTextures(): Array<LinePatternTexture | HatchPatternTexture | PolylineCumDistTexture> {
    return [
      ...(this._linePatternTexture ? [this._linePatternTexture] : []),
      ...(this._hatchPatternTexture ? [this._hatchPatternTexture] : []),
      ...(this._polylineCumDistTexture ? [this._polylineCumDistTexture] : [])
    ];
  }

  private _clearTexture<T extends { destroy(): void }>(texture: T | null): null {
    if (texture) {
      texture.destroy();
    }
    return null;
  }
}

/**
 * Computes per-line-segment cumulative model-space distance from the parent
 * polyline start, using the same consecutive-shared-endpoint definition that
 * the thick-line shader uses for miter joins.
 */
function computePolylineCumDist(
  indices: ArrayLike<number>,
  positionsCompressed: ArrayLike<number>,
  aabb: ArrayLike<number>,
): Float32Array {
  const numSegments = (indices.length / 2) | 0;
  if (numSegments <= 0) {
    return new Float32Array(0);
  }
  const xMin = aabb[0], yMin = aabb[1], zMin = aabb[2];
  const xMax = aabb[3], yMax = aabb[4], zMax = aabb[5];
  const sx = (xMax - xMin) / 65535;
  const sy = (yMax - yMin) / 65535;
  const sz = (zMax - zMin) / 65535;
  const pos = (vertexIdx: number, out: [number, number, number]): void => {
    const o = vertexIdx * 3;
    out[0] = xMin + positionsCompressed[o] * sx;
    out[1] = yMin + positionsCompressed[o + 1] * sy;
    out[2] = zMin + positionsCompressed[o + 2] * sz;
  };
  const out = new Float32Array(numSegments);
  const pA: [number, number, number] = [0, 0, 0];
  const pB: [number, number, number] = [0, 0, 0];
  let prevEndIdx = -1;
  let cumDist = 0;
  let prevLen = 0;
  for (let i = 0; i < numSegments; i++) {
    const aIdx = indices[i * 2];
    const bIdx = indices[i * 2 + 1];
    if (aIdx === prevEndIdx) {
      cumDist += prevLen;
    } else {
      cumDist = 0;
    }
    out[i] = cumDist;
    pos(aIdx, pA);
    pos(bIdx, pB);
    const dx = pB[0] - pA[0];
    const dy = pB[1] - pA[1];
    const dz = pB[2] - pA[2];
    prevLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    prevEndIdx = bIdx;
  }
  return out;
}
