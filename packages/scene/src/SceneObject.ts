import type {Mesh} from "./Mesh";
import type {FloatArrayParam} from "@xeokit/math";
import type {RendererObject} from "./RendererObject";
import type {Scene} from "./Scene";
import type {SceneModel} from "./SceneModel";
import {collapseAABB3, createAABB3, expandAABB3Points3} from "@xeokit/boundaries";
import {getSceneObjectGeometry} from "./getSceneObjectGeometry";

/**
 * An object in a {@link @xeokit/scene!SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.objects | SceneModel.objects} and {@link @xeokit/scene!Scene.objects | Scene.objects}
 * * Created with {@link @xeokit/scene!SceneModel.createObject | SceneModel.createObject}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export class SceneObject {

    /**
     * The {@link SceneModel} that contains this SceneObject.
     */
    public readonly model: SceneModel;

    /**
     * Unique ID of this SceneObject.
     *
     * SceneObjects are stored by ID in {@link Scene.objects | Scene.objects} and {@link SceneModel.objects | SceneModel.objects}.
     */
    public readonly id: string;

    /**
     * The {@link Mesh | Meshes} belonging to this SceneObject.
     */
    public readonly meshes: Mesh[];

    /**
     * Optional layer ID for this SceneObject.
     */
    public readonly layerId?: string;

    /**
     *  Internal interface through which a {@link SceneObject} can load property updates into a renderer.
     *
     *  This is defined while the owner {@link SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
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
        meshes: Mesh[];
        id: string;
        layerId?: string;
    }) {
        this.id = cfg.id;
        this.layerId = cfg.layerId;
        this.meshes = cfg.meshes;
        this.#aabb = createAABB3();
        this.#aabbDirty = true;
        this.rendererObject = null;
    }

    /**
     * Gets the axis-aligned 3D World-space boundary of this SceneObject.
     */
    get aabb(): FloatArrayParam {
        if (this.#aabbDirty) {
            collapseAABB3(this.#aabb);
            getSceneObjectGeometry(this, (geometryView) => {
                expandAABB3Points3(this.#aabb, geometryView.positionsWorld);
                return false;
            });
            this.#aabbDirty = false;
        }
        return this.#aabb;
    }

    /**
     * @private
     */
    setAABBDirty() {
        this.#aabbDirty = true;
    }
}
