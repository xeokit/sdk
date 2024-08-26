import type {SceneMesh} from "./SceneMesh";
import type {FloatArrayParam} from "@xeokit/math";
import type {RendererObject} from "./RendererObject";
import type {SceneModel} from "./SceneModel";
import {collapseAABB3,  expandAABB3} from "@xeokit/boundaries";
import {SceneObjectParams} from "./SceneObjectParams";

/**
 * An object in a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.objects | SceneModel.objects} and {@link @xeokit/scene!Scene.objects | Scene.objects}
 * * Created with {@link @xeokit/scene!SceneModel.createObject | SceneModel.createObject}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneObject {

    /**
     * Unique ID of this SceneObject.
     *
     * SceneObjects are stored by ID in {@link @xeokit/scene!Scene.objects | Scene.objects}
     * and {@link @xeokit/scene!SceneModel.objects | SceneModel.objects}.
     */
    public readonly id: string;

    /**
     * ID of this SceneObject within the originating system.
     */
    public readonly originalSystemId: string;

    /**
     * Optional layer ID for this SceneObject.
     */
    public readonly layerId?: string;

    /**
     * The {@link @xeokit/scene!SceneModel | SceneModel} that contains this SceneObject.
     */
    public readonly model: SceneModel;

    /**
     * The {@link @xeokit/scene!SceneMesh | Meshes} belonging to this SceneObject.
     */
    public readonly meshes: SceneMesh[];

    /**
     *  Internal interface through which a {@link @xeokit/viewer!ViewObject | ViewObject} can load property updates
     *  into a {@link @xeokit/viewer!Renderer | Renderer} for this SceneObject.
     *
     *  This is defined when the owner {@link @xeokit/scene!SceneModel | SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObject: RendererObject | null;

    #aabb: FloatArrayParam;
    #aabbDirty: boolean;

    /**
     * @private
     */
    constructor(cfg: {
        model: SceneModel;
        meshes: SceneMesh[];
        id: string;
        originallSystemId?: string;
        layerId?: string;
    }) {
        this.id = cfg.id;
        this.originalSystemId = cfg.originallSystemId || this.id;
        this.layerId = cfg.layerId;
        this.meshes = cfg.meshes;
        this.#aabb = null;
        this.#aabbDirty = true;
        this.rendererObject = null;
    }

    /**
     * @private
     */
    setAABBDirty() {
        this.#aabbDirty = true;
    }

    /**
     * Gets the axis-aligned 3D World-space boundary of this SceneObject.
     */
    get aabb(): FloatArrayParam {
        if (this.meshes.length === 1) {
            return this.meshes[0].aabb;
        }
        if (this.#aabbDirty) {
            if (!this.#aabb) {
                this.#aabb = collapseAABB3();
            } else {
                collapseAABB3(this.#aabb);
            }
            for (let i = 0, len = this.meshes.length; i < len; i++) {
                expandAABB3(this.#aabb, this.meshes[i].aabb);
            }
            this.#aabbDirty = false;
        }
        return this.#aabb;
    }

    /**
     * Gets this SceneObject as JSON.
     */
    getJSON(): SceneObjectParams {
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
        return sceneObjectParams;
    }
}
