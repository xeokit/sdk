import {Mesh} from "./Mesh";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";
import {RendererObject} from "./RendererObject";
import {Scene} from "./Scene";
import {SceneModel} from "./SceneModel";

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
    public meshes: Mesh[];

    /**
     * Optional layer ID for this SceneObject.
     */
    public layerId?: string;

    /**
     *  Internal interface through which a {@link SceneObject} can load property updates into a renderer.
     *
     *  This is defined while the owner {@link SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObject?: RendererObject;

    constructor(cfg: {
        model: SceneModel;
        meshes: Mesh[];
        id: string;
        layerId?: string;
    }) {
        this.id = cfg.id;
        this.layerId = cfg.layerId;
        this.meshes = cfg.meshes;
    }

    /**
     * Gets the axis-aligned 3D World-space boundary of this SceneObject.
     */
    get aabb(): FloatArrayParam {
        //this.#aabb
        this.getGeometry((positions, indices): boolean | undefined => {
            return;
        });
        return undefined;
    }

    /**
     * Gets the decompressed 3D World-space geometry of each {@link GeometryBucket} in each
     * {@link Geometry} in each {@link Mesh} in this SceneObject.
     *
     * If the callback returns ````true````, then this method immediately stops iterating and also returns ````true````.
     *
     * @param withGeometry
     */
    getGeometry(
        withGeometry: (primitiveType: number, positions: FloatArrayParam, indices?: IntArrayParam)
            => boolean | undefined)
        : boolean | undefined {
        for (let i = 0, len = this.meshes.length; i < len; i++) {
            const mesh = this.meshes[i];
            if (mesh.getGeometry(withGeometry)) {
                return true;
            }
        }
    }
}
