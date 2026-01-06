import type {SceneMesh} from "../../../scene";
import type {RenderContext} from "../RenderContext";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import type {MeshBatch} from "./MeshBatch";
import type {MeshBatchMeshHandle} from "./MeshBatchMeshHandle";
import type {GPUMemoryMeshHandle} from "../gpuMemoryManager/GPUMemoryMeshHandle";
import type {GPUMemoryManager} from "../gpuMemoryManager/GPUMemoryManager";
import type {SDKResult} from "../../../core";
import type {Mat4, Vec3} from "../../../math";

/**
 * A MeshBatchImpl manages a batch of SceneMeshes that use the same primitive type.
 *
 * @private
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

    /**
     * Creates a new MeshBatchImpl instance.
     * @param batchParams
     */
    constructor(batchParams: {
        renderContext: RenderContext;
        gpuMemoryManager: GPUMemoryManager;
        gpuMemoryBatchIndex: number;
        primitive: number;
    }) {
        const {renderContext, gpuMemoryManager, primitive} = batchParams;
        this._renderContext = renderContext;
        this._gpuMemoryManager = gpuMemoryManager;
        this.gpuMemoryBatchIndex = batchParams.gpuMemoryBatchIndex;
        this.primitive = primitive;
        this.primBaseIndex = 0; // TODO
        this.sortId = `batch-${primitive}`;
        this.numIndices = 0;
        this.numVertices = 0;
        this.saoSupported = false;
    }

    /**
     * A hash string representing this batch, used for quick comparisons.
     */
    public get hash(): string {
        return `${this.primitive}`;
    }

    /**
     * Checks if there are any meshes in this batch that should be rendered in the specified render pass for the given view.
     *
     * @param viewIndex - The index of the view to check.
     * @param renderPass - The render pass to check for (e.g., opaque, transparent).
     * @returns True if there are meshes to render in the specified pass, false otherwise.
     */
    public hasMeshesInRenderPass(viewIndex: number, renderPass: RenderPassValue): boolean {
        return (<GPUMemoryManager>this._gpuMemoryManager).dataTextures.batches[this.gpuMemoryBatchIndex]
            ?.views[viewIndex]
            ?.renderPassPrimRanges.get(<number>renderPass)
            ?.numPrims! > 0; // Single point-of-truth for mesh counts
    }

    /**
     * Determines if a mesh can be added to this batch based on available GPU memory.
     *
     * @param sceneMesh - The SceneMesh to check.
     * @returns True if the mesh can be added, false otherwise.
     */
    public canAddMesh(sceneMesh: SceneMesh): boolean {
        return this._gpuMemoryManager.hasMemoryForMesh(this.gpuMemoryBatchIndex, sceneMesh);
    }

    /**
     * Adds a mesh to the batch, updates the mesh counts, and allocates GPU memory for it.
     *
     * @param sceneMesh - The SceneMesh to add.
     * @returns A handle to the added mesh in the batch's GPU memory.
     */
    public addMesh(sceneMesh: SceneMesh): SDKResult<MeshBatchMeshHandle> {
      const gpuMeshHandleResult = this._gpuMemoryManager.addMesh(this.gpuMemoryBatchIndex, sceneMesh);
      if (gpuMeshHandleResult.ok) {
        const gpuMeshHandle = gpuMeshHandleResult.value;
        this.numIndices += gpuMeshHandle.numIndices;
        this.numVertices += gpuMeshHandle.numVertices;
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
        this._gpuMemoryManager.removeMesh(gpuMeshHandle);
        this.numIndices -= gpuMeshHandle.numIndices;
        this.numVertices -= gpuMeshHandle.numVertices;
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
    _setMeshObjectFlags(viewIndex: number, meshHandle: MeshBatchMeshHandle, renderFlags: number): void {
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
     * Sets per-view mesh highlight state.
     */
    public setMeshHighlighted(viewIndex: number, meshHandle: MeshBatchMeshHandle, highlighted: boolean, transparent: boolean): void {
        if (highlighted) {
            this._gpuMemoryManager.setMeshRenderPass(meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.HIGHLIGHTED);
        } else {
            this._gpuMemoryManager.setMeshRenderPass(meshHandle, viewIndex,
                transparent ? RENDER_PASSES.TRANSPARENT : RENDER_PASSES.OPAQUE);
        }
    }

    /**
     * Sets per-view mesh x-ray state.
     */
    public setMeshXRayed(viewIndex: number, meshHandle: MeshBatchMeshHandle, xrayed: boolean, transparent: boolean): void {
        if (xrayed) {
            this._gpuMemoryManager.setMeshRenderPass(meshHandle, viewIndex, RENDER_PASSES.XRAYED);
        } else {
            this._gpuMemoryManager.setMeshRenderPass(meshHandle, viewIndex,
                transparent ? RENDER_PASSES.TRANSPARENT : RENDER_PASSES.OPAQUE);
        }
    }

    /**
     * Sets per-view mesh selected state.
     */
    public setMeshSelected(viewIndex: number, meshHandle: MeshBatchMeshHandle, selected: boolean, transparent: boolean): void {
        if (selected) {
            this._gpuMemoryManager.setMeshRenderPass(meshHandle as GPUMemoryMeshHandle, viewIndex, RENDER_PASSES.SELECTED);
        } else {
            this._gpuMemoryManager.setMeshRenderPass(meshHandle, viewIndex,
                transparent ? RENDER_PASSES.TRANSPARENT : RENDER_PASSES.OPAQUE);
        }
    }

    /**
     * Sets per-view mesh clippable state.
     */
    public setMeshClippable(viewIndex: number, meshHandle: MeshBatchMeshHandle, clippable: boolean): void {
        // this.meshCounts[viewIndex].numClippable += clippable ? 1 : -1;
        //this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
    }

    /**
     * Sets per-view mesh culling state.
     */
    public setMeshCulled(viewIndex: number, meshHandle: MeshBatchMeshHandle, culled: boolean): void {
        // this.meshCounts[viewIndex].numCulled += culled ? 1 : -1;
        // this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
    }

    /**
     * Sets per-view mesh pickable state.
     */
    public setMeshPickable(viewIndex: number, meshHandle: MeshBatchMeshHandle, pickable: boolean): void {
        // this.meshCounts[viewIndex].numPickable += pickable ? 1 : -1;
        // this._setMeshObjectFlags(viewIndex, meshHandle, renderFlags);
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
            opacity
        });
    }
    /**
     * Sets the transformation matrix for a mesh.
     */
    public setMeshMatrix(meshHandle: MeshBatchMeshHandle, rtcMatrix: Mat4): void {
        this._gpuMemoryManager.setMeshMatrix(meshHandle as GPUMemoryMeshHandle, rtcMatrix);
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
     * Destroys this MeshBatchImpl instance.
     */
    public destroy(): void {
        this._renderContext = null;
        this._gpuMemoryManager = null;
    }
}


