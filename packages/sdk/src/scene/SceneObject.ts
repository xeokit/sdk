import type {SceneMesh} from "./SceneMesh";
import type {SceneModel} from "./SceneModel";
import type {SceneObjectParams} from "./SceneObjectParams";
import {SDKErrorType, SDKResult} from "../core";

/**
 * An object within a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.objects | SceneModel.objects} and {@link Scene.objects | Scene.objects}
 * * Created with {@link SceneModel.createObject | SceneModel.createObject}
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export class SceneObject {

    /**
     * Unique ID of this SceneObject.
     *
     * SceneObjects are stored by ID in {@link Scene.objects | Scene.objects}
     * and {@link SceneModel.objects | SceneModel.objects}.
     */
    public readonly id: string;

    /**
     * ID of this SceneObject within the originating system.
     */
    public readonly originalSystemId: string;

    /**
     * Optional layer ID for this SceneObject.
     *
     * When the {@link Scene} is attached to a {@link viewer!View | View}, this will identify an optional {@link viewer!ViewLayer | ViewLayer}
     * to assign the object to. ViewLayers allow users to group and segregate object based on their roles or aspects in a scene,
     * simplifying interaction and focusing operations on specific object groups.
     */
    public readonly layerId?: string;

    /**
     * The {@link SceneModel | SceneModel} that contains this SceneObject.
     */
    public readonly model: SceneModel;

    /**
     * The {@link SceneMesh | Meshes} belonging to this SceneObject.
     */
    public readonly meshes: SceneMesh[];

    /**
     * True if this SceneObject has been destroyed.
     */
    public destroyed: boolean = false;

    /**
     * @private
     */
    constructor(cfg: {
        model: SceneModel;
        meshes: SceneMesh[];
        id: string;
        originalSystemId?: string;
        layerId?: string;
    }) {
        this.id = cfg.id;
        this.originalSystemId = cfg.originalSystemId || this.id;
        this.layerId = cfg.layerId;
        this.model = cfg.model;
        this.meshes = cfg.meshes;
    }

    /**
     * Gets this SceneObject as SceneObjectParams.
     */
    toParams(): SDKResult<SceneObjectParams, string> {
        if (this.destroyed) {
            return this.model.scene.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[SceneObject.toParams] SceneObject already destroyed"
            });
        }
        const sceneObjectParams = <SceneObjectParams>{
            id: this.id,
            meshIds: []
        };
        if (this.layerId != undefined) {
            sceneObjectParams.layerId = this.layerId;
        }
        if (this.meshes != undefined) {
            for (let i = 0, len = this.meshes.length; i < len; i++) {
                sceneObjectParams.meshIds.push(this.meshes[i].id);
            }
        }
        return {
            ok: true,
            value: sceneObjectParams
        };
    }

    /**
     * Destroys this SceneObject.
     */
    destroy(): SDKResult<void, string> {
        if (this.destroyed) {
            return this.model.scene.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[SceneObject.destroy] SceneObject already destroyed"
            });
        }
        this.model._destroyObject(this);
        this.destroyed = true;
        return {
            ok: true,
            value: undefined
        };
    }
}
