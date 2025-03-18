import { collapseAABB3, expandAABB3 } from "../boundaries";
/**
 * An object in a {@link scene!SceneModel | SceneModel}.
 *
 * * Stored in {@link scene!SceneModel.objects | SceneModel.objects} and {@link scene!Scene.objects | Scene.objects}
 * * Created with {@link scene!SceneModel.createObject | SceneModel.createObject}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneObject {
    /**
     * Unique ID of this SceneObject.
     *
     * SceneObjects are stored by ID in {@link scene!Scene.objects | Scene.objects}
     * and {@link scene!SceneModel.objects | SceneModel.objects}.
     */
    id;
    /**
     * ID of this SceneObject within the originating system.
     */
    originalSystemId;
    /**
     * Optional layer ID for this SceneObject.
     */
    layerId;
    /**
     * The {@link scene!SceneModel | SceneModel} that contains this SceneObject.
     */
    model;
    /**
     * The {@link scene!SceneMesh | Meshes} belonging to this SceneObject.
     */
    meshes;
    /**
     *  Internal interface through which a {@link viewer!ViewObject | ViewObject} can load property updates
     *  into a {@link viewer!Renderer | Renderer} for this SceneObject.
     *
     *  This is defined when the owner {@link scene!SceneModel | SceneModel} has been added to a {@link viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObject;
    #aabb;
    #aabbDirty;
    /**
     * @private
     */
    constructor(cfg) {
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
    get aabb() {
        if (this.meshes.length === 1) {
            return this.meshes[0].aabb;
        }
        if (this.#aabbDirty) {
            if (!this.#aabb) {
                this.#aabb = collapseAABB3();
            }
            else {
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
    getJSON() {
        const sceneObjectParams = {
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
//# sourceMappingURL=SceneObject.js.map