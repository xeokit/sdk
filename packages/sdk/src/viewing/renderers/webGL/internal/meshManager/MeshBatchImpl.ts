import type {SceneMesh} from "../../../../../model/scene";
import type {RenderContext} from "../RenderContext";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import type {MeshBatch} from "./MeshBatch";
import type {MeshBatchMeshHandle} from "./MeshBatchMeshHandle";
import type {GPUMemoryMeshHandle, GPUMemoryMeshPlacement} from "../gpuMemoryManager/GPUMemoryMeshHandle";
import type {GPUMemoryManager} from "../gpuMemoryManager/GPUMemoryManager";
import type {SDKResult} from "../../../../../base/core";
import type {Mat4} from "../../../../../base/math/matrix";
import type {Vec3} from "../../../../../base/math/vector";
import {GPUMemoryCheckResult} from "../gpuMemoryManager";
import {LinesPrimitive, TrianglesPrimitive} from "../../../../../base/constants";
import type {TriangleGeometryStorageKind} from "../gpuMemoryManager/BatchGPUResources";
import type {MeshManagerStepStats} from "./MeshManagerStepStats";
import type {LODRepMembership} from "../../../../lod/LODVisibility";

function getMeshIndexCount(sceneMesh: SceneMesh): number {
  return sceneMesh.geometry.indices ? sceneMesh.geometry.indices.length : 0;
}

function getMeshVertexCount(sceneMesh: SceneMesh): number {
  return sceneMesh.geometry.positionsCompressed ? sceneMesh.geometry.positionsCompressed.length / 3 : 0;
}

function createLODRepMembershipKey(memberships: readonly LODRepMembership[] | undefined): string {
  if (!memberships || memberships.length === 0) {
    return "";
  }
  return memberships
    .map((membership) => `${membership.selectionId}:${membership.repIds.join(",")}`)
    .join(";");
}

/**
 * A MeshBatchImpl manages a batch of SceneMeshes that use the same primitive type.
 *
 * @internal
 */
export class MeshBatchImpl implements MeshBatch {

  /**
   * The render context associated with this batch.
   */
  private _renderContext: RenderContext;

  /**
   * The GPUMemoryManager instance used to manage the GPU data memory for this batch.
   */
  private _gpuMemoryManager: GPUMemoryManager;

  /**
   * Primitive type of the meshes in this batch.
   */
  primitive: number;

  /**
   * Geometry storage used by this batch.
   */
  readonly geometryStorage: TriangleGeometryStorageKind;

  /**
   * Whether the geometries in this batch carry per-vertex normals.
   *
   * Set at construction from the first mesh that lands in the batch and
   * never mutates afterward — {@link MeshManager} prevents geometries with
   * a different `hasNormals` value from joining.
   */
  readonly hasNormals: boolean;

  /**
   * Whether the geometries in this batch carry per-vertex UV coordinates.
   *
   * Independent axis from {@link hasNormals}; same constancy guarantee.
   */
  readonly hasUVs: boolean;

  /**
   * Whether the renderer should sample this batch's textures via the
   * **triplanar** world-space fallback rather than the usual
   * UV-attribute path.
   *
   * Set when the batch's meshes share the property
   * `(material has any texture) && (geometry has no UVs)` — typical
   * of BIM, sweeps, and lofted curve geometry that loaders produce
   * without UV data. Mutually exclusive with {@link hasUVs} by
   * definition; the triplanar shader variant ignores the vertex UV
   * attribute and derives sample coordinates from world position.
   *
   * Same constancy guarantee as the other axes — never mutates
   * after construction; {@link MeshManager} prevents incompatible
   * meshes from joining.
   */
  readonly triplanar: boolean;

  /**
   * Whether this batch's atlases carry mip pyramids and sample
   * trilinearly. Derived from the meshes' materials at batch-
   * construction time — `true` when any bound texture opted into
   * mipmaps via `SceneTextureParams.mipmap`. Same constancy
   * guarantee as the other axes.
   */
  readonly mipmap: boolean;

  /**
   * Free-form bin identifier shared by every mesh in this batch.
   * {@link MeshManager} hashes meshes into batches by this value so a
   * batch is always bin-homogeneous; `undefined` means the implicit
   * "default" bin. The renderer reads this to schedule a separate
   * overlay pass with the depth buffer cleared.
   */
  readonly bin?: string;

  /**
   * Representation-set memberships shared by every mesh in this batch.
   */
  readonly lodRepMemberships?: readonly LODRepMembership[];

  /**
   * Base primitive tileIndex for this batch.
   */
  primBaseIndex: number;

  /**
   * A unique identifier for sorting this batch in the renderer.
   */
  sortId: string;

  /**
   * Whether this batch supports Screen Space Ambient Occlusion (SSAO) rendering.
   */
  saoSupported: boolean;

  /**
   * Whether this batch supports directional shadow-map rendering.
   */
  shadowsSupported: boolean;

  /**
   * The total number of indices in all meshes of this batch. This is used with WebGL render calls to determine how many indices to render
   * when drawing this batch.
   */
  numIndices: number;

  /**
   * The total number of vertices in all meshes of this batch. This is used for various calculations and optimizations related to rendering.
   */
  numVertices: number;

  /**
   * The index of this batch in the GPUMemoryManager system.
   */
  public readonly gpuMemoryBatchIndex: number;

  private readonly _styleBinClearDepthBeforeCounts: Uint32Array;
  private readonly _styleBinClearDepthBeforeFlags: Uint8Array;

  /**
   * Creates a new MeshBatchImpl instance.
   * @param batchParams
   */
  constructor(batchParams: {
    renderContext: RenderContext;
    gpuMemoryManager: GPUMemoryManager;
    gpuMemoryBatchIndex: number;
    primitive: number;
    hasNormals: boolean;
    hasUVs: boolean;
    triplanar: boolean;
    mipmap: boolean;
    geometryStorage: TriangleGeometryStorageKind;
    bin?: string;
    lodRepMemberships?: readonly LODRepMembership[];
  }) {
    const {renderContext, gpuMemoryManager, primitive, hasNormals, hasUVs, triplanar, mipmap, geometryStorage, bin, lodRepMemberships} = batchParams;
    this._renderContext = renderContext;
    this._gpuMemoryManager = gpuMemoryManager;
    this.gpuMemoryBatchIndex = batchParams.gpuMemoryBatchIndex;
    this._styleBinClearDepthBeforeCounts = new Uint32Array(renderContext.memoryConfigs.maxViews);
    this._styleBinClearDepthBeforeFlags = new Uint8Array(renderContext.memoryConfigs.maxViews * renderContext.memoryConfigs.maxBatchMeshes);
    this.primitive = primitive;
    this.hasNormals = hasNormals === true;
    this.hasUVs = hasUVs === true;
    this.triplanar = triplanar === true;
    this.mipmap = mipmap === true;
    this.geometryStorage = geometryStorage;
    this.bin = bin;
    this.lodRepMemberships = lodRepMemberships;
    this.primBaseIndex = 0; // TODO
    this.sortId = `batch-${primitive}-${this.geometryStorage}-${this.hasNormals ? "n" : "f"}-${this.hasUVs ? "u" : "x"}-${this.triplanar ? "t" : "p"}-${this.mipmap ? "m" : "0"}-${this.bin ?? ""}-${createLODRepMembershipKey(lodRepMemberships)}`;
    this.numIndices = 0;
    this.numVertices = 0;
    // SAO and Shadows are triangle-only effects: the line / point draw-op
    // tables have no `opaqueSAO`/`opaqueShadow`/`opaqueSAOShadow` entries.
    // Marking line/point batches as supporting them would route them into
    // bins whose dispatch is a no-op, and they'd never render.
    this.saoSupported = (primitive === TrianglesPrimitive);
    this.shadowsSupported = (primitive === TrianglesPrimitive);
  }

  /**
   * A hash string representing this batch, used for quick comparisons.
   */
  public get hash(): string {
    return `${this.primitive}-${this.geometryStorage}-${this.hasNormals ? 1 : 0}-${this.hasUVs ? 1 : 0}-${this.triplanar ? 1 : 0}-${this.mipmap ? 1 : 0}-${createLODRepMembershipKey(this.lodRepMemberships)}`;
  }

  /**
   * Checks if there are any meshes in this batch that should be rendered in the specified render pass for the given view.
   *
   * @param viewIndex - The index of the view to check.
   * @param renderPass - The render pass to check for (e.g., opaque, transparent).
   * @returns True if there are meshes to render in the specified pass, false otherwise.
   */
  public hasMeshesInRenderPass(viewIndex: number, renderPass: RenderPassValue): boolean {
    const batchResources = (<GPUMemoryManager>this._gpuMemoryManager).gpuResources?.batches[this.gpuMemoryBatchIndex];
    if (!batchResources) {
      return false;
    }
    const batchViewResources = batchResources.views[viewIndex];
    if (!batchViewResources) {
      return false;
    }
    // PICK and SNAP_INIT draw the pickable-triangle set
    // (`pickPrimitiveRange`); SNAP draws corner vertices and crease
    // edges only — those ride the dihedral-angle-thresholded edge
    // index buffer for triangle batches (`pickEdgePrimitiveRange`).
    //
    // LinesPrimitive batches don't have a separate edge buffer —
    // the lines themselves *are* the edges, so SNAP for those
    // batches consults `pickPrimitiveRange` (the line index range)
    // and rasterises endpoints (vertex snap) or the lines as
    // 1-pixel `gl.LINES` (edge snap) into the snap FBO.
    if (renderPass === RENDER_PASSES.PICK ||
        renderPass === RENDER_PASSES.SNAP_INIT) {
      return batchViewResources.pickPrimitiveRange.numPrims > 0;
    }
    if (renderPass === RENDER_PASSES.SNAP) {
      return this.primitive === LinesPrimitive
        ? batchViewResources.pickPrimitiveRange.numPrims > 0
        : batchViewResources.pickEdgePrimitiveRange.numPrims > 0;
    }
    return batchViewResources.renderPassPrimitiveRanges.get(<number>renderPass)?.numPrims! > 0;
  }

  public hasStyleBinClearDepthBefore(viewIndex: number): boolean {
    return this._styleBinClearDepthBeforeCounts[viewIndex] > 0;
  }

  /**
   * Checks if there are any meshes in this batch that should be rendered in the edge render pass for the given view.
   *
   * @param viewIndex - The index of the view to check.
   * @param renderPass - The render pass to check for edge rendering.
   * @return True if there are meshes to render in the edge render pass, false otherwise.
   */
  public hasMeshesInEdgeRenderPass(viewIndex: number, renderPass: RenderPassValue): boolean {
    return (<GPUMemoryManager>this._gpuMemoryManager).gpuResources?.batches[this.gpuMemoryBatchIndex]
      ?.views[viewIndex]
      ?.renderPassEdgePrimitiveRanges.get(<number>renderPass)
      ?.numPrims! > 0; // Single point-of-truth for mesh counts
  }

  /**
   * Determines if a mesh can be added to this batch based on available GPU memory.
   *
   * @param sceneMesh - The SceneMesh to check.
   * @returns A GPUMemoryCheckResult indicating whether the mesh can be added and any relevant details about memory usage.
   */
  public canAddMesh(sceneMesh: SceneMesh): GPUMemoryCheckResult {
    return this._gpuMemoryManager.hasMemoryForMesh(this.gpuMemoryBatchIndex, sceneMesh);
  }

  public beginBulkMeshAdd(stats?: MeshManagerStepStats | null): void {
    this._gpuMemoryManager.beginBulkMeshAdd(this.gpuMemoryBatchIndex, stats);
  }

  public endBulkMeshAdd(stats?: MeshManagerStepStats | null): void {
    this._gpuMemoryManager.endBulkMeshAdd(this.gpuMemoryBatchIndex, stats);
  }

  /**
   * Adds a mesh to the batch, updates the mesh counts, and allocates GPU memory for it.
   *
   * @param sceneMesh - The SceneMesh to add.
   * @returns A handle to the added mesh in the batch's GPU memory.
   */
  public addMesh(sceneMesh: SceneMesh, placement?: GPUMemoryMeshPlacement, stats?: MeshManagerStepStats | null): SDKResult<MeshBatchMeshHandle> {
    const gpuMeshHandleResult = this._gpuMemoryManager.addMesh(this.gpuMemoryBatchIndex, sceneMesh, placement, stats);
    if (gpuMeshHandleResult.ok) {
      this.numIndices += getMeshIndexCount(sceneMesh);
      this.numVertices += getMeshVertexCount(sceneMesh);
    }
    return gpuMeshHandleResult;
  }

  /**
   * Removes a mesh from the batch, updates the mesh counts, and deallocates its GPU memory.
   *
   * @param meshHandle - The handle of the mesh to remove.
   */
  public removeMesh(meshHandle: MeshBatchMeshHandle): void {
    const gpuMeshHandle = meshHandle as GPUMemoryMeshHandle;
    const sceneMesh = this._gpuMemoryManager.getMeshAtIndex(this.gpuMemoryBatchIndex, gpuMeshHandle.meshIndex);
    for (let viewIndex = 0; viewIndex < this._styleBinClearDepthBeforeCounts.length; viewIndex++) {
      const stateIndex = viewIndex * this._renderContext.memoryConfigs.maxBatchMeshes + gpuMeshHandle.meshIndex;
      if (this._styleBinClearDepthBeforeFlags[stateIndex]) {
        this._styleBinClearDepthBeforeFlags[stateIndex] = 0;
        this._styleBinClearDepthBeforeCounts[viewIndex]--;
      }
    }
    this._gpuMemoryManager.removeMesh(gpuMeshHandle);
    if (sceneMesh) {
      this.numIndices -= getMeshIndexCount(sceneMesh);
      this.numVertices -= getMeshVertexCount(sceneMesh);
    }
  }

  /**
   * Retrieves the SceneMesh at the specified index in this batch, if it exists.
   *
   * @param meshIndex - The index of the mesh to retrieve.
   * @returns The SceneMesh at the specified index, or null if not found.
   */
  public getMeshAtIndex(meshIndex: number): SceneMesh | null {
    return this._gpuMemoryManager.getMeshAtIndex(this.gpuMemoryBatchIndex, meshIndex);
  }

  /**
   * Retrieves the parameters needed for a WebGL drawArrays call for a specific mesh in this batch.
   *
   * @param meshIndex - The index of the mesh to retrieve parameters for.
   * @returns An object containing the `first` and `count` parameters, or null if not found.
   */
  public getDrawArraysParamsForMesh(meshIndex: number): { first: number; count: number } | null {
    return this._gpuMemoryManager.getDrawArraysParamsForMesh(this.gpuMemoryBatchIndex, meshIndex);
  }

  /**
   * Sets the render flags for a mesh in a specific view based on its visibility and interaction states.
   * @private
   */
  private _setMeshObjectFlags(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number): void {
    // const isPickable = (renderFlags & RENDER_FLAGS.PICKABLE) !== 0;
    // const isClippable = (renderFlags & RENDER_FLAGS.CLIPPABLE) !== 0;
    // const pickFlag = isPickable ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;
    // const renderFlags2 = pickFlag | (isClippable << 4);
    // this._gpuMemoryManager.setMeshViewAttribs(meshHandle as GPUMemoryMeshHandle, viewIndex, {
    //   renderFlags: renderFlags2
    // });
  }

  /**
   * Sets the visibility state of a mesh for a specific view.
   *
   * @param viewIndex - The index of the view.
   * @param meshHandle - The handle of the mesh.
   * @param visible - True to make the mesh visible, false to hide it.
   */
  public setMeshVisible(viewIndex: number, meshHandle: MeshBatchMeshHandle, visible: boolean): void {
    this._gpuMemoryManager.setMeshVisible(meshHandle as GPUMemoryMeshHandle, viewIndex, visible);
  }

  /**
   * Updates the per-view clippable flag for a mesh —
   * rewrites the corresponding `clippable` byte in the
   * MeshViewAttributeTexture so the FS clip loop honours
   * the new state on the next frame.
   */
  public setMeshClippable(viewIndex: number, meshHandle: MeshBatchMeshHandle, clippable: boolean): void {
    this._gpuMemoryManager.setMeshClippable(meshHandle as GPUMemoryMeshHandle, viewIndex, clippable);
  }

  /**
   * Sets the mesh to be opaque for the specified view.
   *
   * @param viewIndex - The index of the view.
   * @param meshHandle - The handle of the mesh.
   * @param renderFlags - The render flags for the mesh.
   */
  public setMeshOpaque(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number): void {
    this._gpuMemoryManager.setMeshRenderPass(meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.OPAQUE);
  }

  /**
   * Sets transparency per-view for the mesh.
   */
  public setMeshTransparent(viewIndex: number, meshHandle: MeshBatchMeshHandle, transparent: boolean): void {
    if (transparent) {
      this._gpuMemoryManager.setMeshRenderPass(meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.TRANSPARENT);
    } else {
      this._gpuMemoryManager.setMeshRenderPass(meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.OPAQUE);
    }
  }

  /**
   * Routes a mesh to the generic style-bin render pass for this view.
   */
  public setMeshStyleBin(viewIndex: number, meshHandle: MeshBatchMeshHandle, transparent: boolean): void {
    this._gpuMemoryManager.setMeshRenderPass(
      meshHandle as GPUMemoryMeshHandle,
      viewIndex,
      transparent ? RENDER_PASSES.STYLE_BIN_TRANSPARENT : RENDER_PASSES.STYLE_BIN_OPAQUE
    );
  }

  /**
   * Sets whether this mesh should draw edges when routed through a style-bin pass.
   */
  public setMeshStyleBinEdges(viewIndex: number, meshHandle: MeshBatchMeshHandle, edges: boolean): void {
    this._gpuMemoryManager.setMeshViewAttribs(meshHandle as GPUMemoryMeshHandle, viewIndex, {
      styleBinEdges: edges
    });
  }

  /**
   * Sets whether this mesh participates in the style-bin depth-cleared overlay.
   */
  public setMeshStyleBinClearDepthBefore(viewIndex: number, meshHandle: MeshBatchMeshHandle, clearDepthBefore: boolean): void {
    const meshIndex = (meshHandle as GPUMemoryMeshHandle).meshIndex;
    const stateIndex = viewIndex * this._renderContext.memoryConfigs.maxBatchMeshes + meshIndex;
    const next = clearDepthBefore ? 1 : 0;
    const prev = this._styleBinClearDepthBeforeFlags[stateIndex];
    if (prev !== next) {
      this._styleBinClearDepthBeforeFlags[stateIndex] = next;
      if (next) {
        this._styleBinClearDepthBeforeCounts[viewIndex]++;
      } else {
        this._styleBinClearDepthBeforeCounts[viewIndex]--;
      }
    }
    this._gpuMemoryManager.setMeshViewAttribs(meshHandle as GPUMemoryMeshHandle, viewIndex, {
      styleBinClearDepthBefore: clearDepthBefore
    });
  }

  // (setMeshClippable defined above — clippable state writes
  // through to MeshViewAttributeTexture so the FS clip loop
  // honours the new state on the next frame.)

  /**
   * Sets per-view mesh culling state. Writes through to the GPU draw
   * index (independent of visibility) so culled meshes are skipped at
   * draw time, just like hidden ones.
   */
  public setMeshCulled(viewIndex: number, meshHandle: MeshBatchMeshHandle, culled: boolean): void {
    this._gpuMemoryManager.setMeshCulled(meshHandle as GPUMemoryMeshHandle, viewIndex, culled);
  }

  /**
   * Sets per-view mesh pickable state.
   */
  public setMeshPickable(viewIndex: number, meshHandle: MeshBatchMeshHandle, pickable: boolean): void {
    this._gpuMemoryManager.setMeshViewAttribs(meshHandle as GPUMemoryMeshHandle, viewIndex, {
      pickable
    });
  }

  /**
   * Sets a custom color per view for a mesh.
   */
  public setMeshColorInView(viewIndex: number, meshHandle: MeshBatchMeshHandle, color: Vec3): void {
    this._gpuMemoryManager.setMeshViewAttribs(meshHandle as GPUMemoryMeshHandle, viewIndex, {
      color
    });
  }

  public setMeshOpacityInView(viewIndex: number, meshHandle: MeshBatchMeshHandle, opacity: number): void {
    this._gpuMemoryManager.setMeshViewAttribs(meshHandle as GPUMemoryMeshHandle, viewIndex, {
      opacity: Math.floor(opacity * 255) // Quantize to [0..255]
    });
  }

  /**
   * Sets the transformation matrix for a mesh.
   */
  public setMeshMatrix(meshHandle: MeshBatchMeshHandle, rtcMatrix: Mat4): void {
    this._gpuMemoryManager.setMeshMatrix(meshHandle as GPUMemoryMeshHandle, rtcMatrix);
  }

  /**
   * Sets the tile and tile-relative matrix for a mesh together.
   */
  public setMeshPlacement(meshHandle: MeshBatchMeshHandle, tileIndex: number, rtcMatrix: Mat4): void {
    this._gpuMemoryManager.setMeshPlacement(meshHandle as GPUMemoryMeshHandle, {
      tileIndex,
      rtcMatrix
    });
  }

  /**
   * Sets the tile tileIndex for a mesh.
   */
  public setMeshTile(meshHandle: MeshBatchMeshHandle, tileIndex: number): void {
    this._gpuMemoryManager.setMeshAttribs(meshHandle as GPUMemoryMeshHandle, {
      tileIndex
    });
  }

  /**
   * Re-packs a mesh's emissive colour factor into its shared MeshAttributeTexture
   * record — used when a material's `emissiveColor` is edited at runtime.
   */
  public setMeshEmissiveColor(meshHandle: MeshBatchMeshHandle, emissiveColor: [number, number, number]): void {
    this._gpuMemoryManager.setMeshAttribs(meshHandle as GPUMemoryMeshHandle, {
      emissiveColor
    });
  }

  /**
   * Destroys this MeshBatchImpl instance.
   */
  public destroy(): void {
    this._renderContext = null;
    this._gpuMemoryManager = null;
  }
}
