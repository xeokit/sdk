import {RenderContext} from "../RenderContext";
import {SDKError, SDKResult} from "../../../core";
import type {
    SceneMesh,
    SceneModel,
    SceneObject,
} from "../../../scene";
import {RendererObject} from "./RendererObject";
import {RendererMesh} from "./RendererMesh";
import {MeshBatchImpl} from "./MeshBatchImpl";
import {type GPUMemoryEditor} from "../gpuMemoryManager/GPUMemoryEditor";
import {MeshBatch} from "./MeshBatch";
import {Camera, ViewObject} from "../../../viewer";
import {SceneTransform} from "../../../scene/SceneTransform";
import {GPUMemoryBatch} from "../gpuMemoryManager/GPUMemoryBatch";

/**
 * The MeshManager manages the relationship between scene objects, their geometries, meshes, and rendering sortedBatches.
 *
 * It listens to the Viewer's Scene for additions and removals of models, objects, meshes and geometries, creating
 * or destroying the corresponding renderer entities as needed.
 *
 * The MeshManager organizes RendererMeshes into DrawLayers based on their primitive type (triangles, lines, points).
 * Each DrawLayer manages GPU resources for rendering its meshes efficiently. The MeshManager creates new DrawLayers as
 * needed when meshes with different primitive types are added.
 */
export class MeshManager {

    private _rendererObjects: Record<string, RendererObject> = {}; // A SceneObject can belong to many SceneModels
    private _renderContext: RenderContext;
    private _gpuMemoryEditor: GPUMemoryEditor;

    private _rendererModels: Record<string, {
        rendererMeshes: Record<string, RendererMesh>;
    }> = {};

    private _sortedBatches: Record<string, MeshBatchImpl> = {};
    private _batchList: MeshBatch[] = [];
    private _batchListDirty = true;

    /**
     * Initializes the MeshManager with the given rendering context and GPU data gpuMemoryManager editor.
     * @param renderContext
     * @param gpuMemoryEditor
     */
    constructor(renderContext: RenderContext, gpuMemoryEditor: GPUMemoryEditor) {
        this._renderContext = renderContext;
        this._gpuMemoryEditor = gpuMemoryEditor;
    }

    /**
     * Initializes the MeshManager by processing existing SceneModels and SceneObjects in the Viewer's Scene.
     */
    init(): SDKResult<void, string> {
        const {
            models: sceneModels,
            objects: sceneObjects
        } = this._renderContext.viewer.scene;
        for (const sceneModelId in sceneModels) {
            this.sceneModelCreated(sceneModels[sceneModelId]);
        }
        for (const sceneObjectId in sceneObjects) {
            const result = this.sceneObjectCreated(sceneObjects[sceneObjectId]);
            if (result.ok === false) {
                return result;
            }
        }
        return {
            ok: true,
            value: undefined
        };
    }

    /**
     * Returns the list of MeshBatches sorted by their primitive type.
     */
    public get sortedBatches(): MeshBatch[] {
        if (this._batchListDirty) {
            // @ts-ignore
            this._batchList = Object.values(this._sortedBatches).sort((a, b) => a.primitive - b.primitive);
            this._batchListDirty = false;
        }
        return this._batchList;
    }

    /**
     * Retrieves a MeshBatch at the specified index, if it exists.
     * @param batchIndex
     */
    public getBatch(batchIndex: number): MeshBatch | null {
        return this._sortedBatches[batchIndex];
    }

    /**
     * Retrieves a SceneMesh within a specific batch at the given index.
     * @param batchIndex
     * @param meshIndex
     */
    public getMeshAtIndex(batchIndex: number, meshIndex: number): SceneMesh | null {
        return this._gpuMemoryEditor.getMeshAtIndex(batchIndex, meshIndex);
    }

    /**
     * Gets the parameters needed for a drawArrays call for a specific mesh in a specific batch.
     * @param batchIndex
     * @param meshIndex
     */
    public getDrawArraysParamsForMesh(batchIndex: number, meshIndex: number): { first: number; count: number } | null {
        return this._gpuMemoryEditor.getDrawArraysParamsForMesh(batchIndex, meshIndex);
    }

    public sceneModelCreated(sceneModel: SceneModel): void {
        this._rendererModels[sceneModel.id] ||= {
            rendererMeshes: {}
        };
    }

    public sceneModelDestroyed(sceneModel: SceneModel): void {
        delete this._rendererModels[sceneModel.id];
    }

    /**
     * Creates a RendererObject for the given SceneObject, along with its associated RendererMeshes.
     * Returns error when memory limit hit.
     * @param sceneObject
     */
    public sceneObjectCreated(sceneObject: SceneObject): SDKResult<any, string> {
        const objectId = sceneObject.id;
        if (this._rendererObjects[objectId]) {
            throw new SDKError(`Already has a SceneObject attached with this ID: ${objectId}`);
        }
        const rendererModel = this._rendererModels[sceneObject.model.id];
        if (!rendererModel) {
            throw new SDKError(`SceneModel not attached with this ID: ${sceneObject.model.id}`);
        }
        const rendererMeshes = [];
        for (const sceneMesh of sceneObject.meshes) {
            const result = this._addMesh(rendererModel, sceneMesh);
            if (result.ok === false) {
                return result;
            }
            const rendererMesh = result.value;
            rendererMeshes.push(rendererMesh);
        }
        this._rendererObjects[objectId] = new RendererObject({
            renderContext: this._renderContext,
            id: objectId,
            rendererMeshes // Zero meshes are OK
        });
        this._batchListDirty = true;
        return {
            ok: true,
            value: undefined
        };
    }

    private _addMesh(rendererModel: any, sceneMesh: SceneMesh): SDKResult<RendererMesh, string> {
        const meshId = sceneMesh.id;
        if (rendererModel.rendererMeshes[meshId]) {
            throw new SDKError(`SceneMesh already attached with this ID: ${meshId}`);
        }
        const result = this._getMeshBatch(sceneMesh);
        if (result.ok === false) {
            return result;
        }
        const meshBatch = result.value;
        const rendererMesh = new RendererMesh({
            renderContext: this._renderContext,
            sceneMesh,
            meshBatch,
            gpuMemoryEditor: this._gpuMemoryEditor
        });
        rendererModel.rendererMeshes[meshId] = rendererMesh;
        return {
            ok: true,
            value: rendererMesh
        };
    }

    private _getMeshBatch(sceneMesh: SceneMesh): SDKResult<MeshBatchImpl, string> {
        const primitive = sceneMesh.geometry.primitive;
        for (const meshBatch of Object.values(this._sortedBatches)) {
            if (meshBatch.primitive === primitive && meshBatch.canAddMesh(sceneMesh)) {
                return {
                    ok: true,
                    value: meshBatch
                };
            }
        }
        const meshBatchId = `meshBatch-${primitive}-${Object.keys(this._sortedBatches).length}`; // TODO: optimize ID generation
        const result = this._gpuMemoryEditor.createBatch();
        if (result.ok === false) {
            return result;
        }
        const gpuMemoryBatchIndex = result.value;
        const newMeshBatch = new MeshBatchImpl({
            primitive,
            renderContext: this._renderContext,
            gpuMemoryEditor: this._gpuMemoryEditor,
            gpuMemoryBatchIndex,
        });
        this._sortedBatches[meshBatchId] = newMeshBatch;
        this._batchListDirty = true;
        return {
            ok: true,
            value: newMeshBatch
        };
    }

    /**
     * Removes a SceneObject and its associated RendererObject from the MeshManager.
     */
    public sceneObjectDestroyed(sceneObject: SceneObject): void {
        const rendererModel = this._rendererModels[sceneObject.model.id];
        if (!rendererModel) {
            return;
        }
        sceneObject.meshes?.forEach((mesh) => this._removeMesh(rendererModel, mesh));
        delete this._rendererObjects[sceneObject.id];
        this._batchListDirty = true;
    }

    private _removeMesh(rendererModel: any, sceneMesh: SceneMesh): void {
        const rendererMesh = rendererModel.rendererMeshes[sceneMesh.id];
        if (!rendererMesh) {
            return;
        }
        // this._removeGeometry(rendererModel, sceneMesh.geometry);
        rendererMesh.destroy();
        delete rendererModel.rendererMeshes[sceneMesh.id];
        this._batchListDirty = true;
        console.log(`MeshBatches: Removed RendererMesh for SceneMesh ID: ${sceneMesh.id}`);
    }

    public sceneTransformMatrixChanged(sceneTransform: SceneTransform): void {
    }

    public sceneMeshMatrixChanged(sceneMesh: SceneMesh): void {
        this._rendererModels[sceneMesh.model.id]?.rendererMeshes[sceneMesh.id]?.setMatrix(sceneMesh.matrix);
    }

    public sceneMeshColorChanged(sceneMesh: SceneMesh): void {
        this._rendererModels[sceneMesh.model.id]?.rendererMeshes[sceneMesh.id]?.setColor(sceneMesh.color);
    }

    public sceneMeshOpacityChanged(sceneMesh: SceneMesh): void {
        // this._rendererModels[sceneMesh.model.id]
        //     ?.rendererMeshes[sceneMesh.id]
        //     ?.setOpacity(viewObject.layer.view.viewIndex, sceneMesh.opacity);
    }

    public viewObjectVisibilityChanged(viewObject: ViewObject): void {
        this._rendererObjects[viewObject.id]?.setVisible(viewObject.layer.view.viewIndex, viewObject.visible);
    }

    viewObjectXRayedChanged(viewObject: ViewObject): void {
        this._rendererObjects[viewObject.id]?.setXRayed(viewObject.layer.view.viewIndex, viewObject.xrayed);
    }

    viewObjectHighlightedChanged(viewObject: ViewObject): void {
        this._rendererObjects[viewObject.id]?.setHighlighted(viewObject.layer.view.viewIndex, viewObject.highlighted);
    }

    viewObjectSelectedChanged(viewObject: ViewObject): void {
        this._rendererObjects[viewObject.id]?.setSelected(viewObject.layer.view.viewIndex, viewObject.selected);
    }

    viewObjectColorizeChanged(viewObject: ViewObject): void {
        this._rendererObjects[viewObject.id]?.setColorize(viewObject.layer.view.viewIndex, viewObject.colorize);
    }

    viewObjectOpacityChanged(viewObject: ViewObject): void {
        this._rendererObjects[viewObject.id]?.setOpacity(viewObject.layer.view.viewIndex, viewObject.opacity);
    }

    public cameraViewMatrixUpdated(camera: Camera) {
        this._gpuMemoryEditor.cameraViewMatrixUpdated(camera);
    }

    public destroy(): void {
        const {viewer} = this._renderContext;
        const {models, objects} = viewer.scene;

        // @ts-ignore
        Object.values(objects).forEach((object) => this._removeObject(object));
        // @ts-ignore
        Object.values(models).forEach((model) => this.sceneModelDestroyed(model));

        // @ts-ignore
        Object.values(this._sortedBatches).forEach((meshBatch) => meshBatch.destroy());

        this._sortedBatches = {};
        this._batchList = [];
        this._rendererObjects = {};
        this._rendererModels = {};
    }

}
