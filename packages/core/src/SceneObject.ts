import type {Mesh} from "./Mesh";

/**
 * Represents an object in a {@link @xeokit/core/components!SceneModel}.
 *
 * * Stored in {@link @xeokit/core/components!SceneModel.objects | SceneModel.objects} and {@link @xeokit/viewer!Scene.objects | Scene.objects}
 * * Created with {@link @xeokit/core/components!SceneModel.createObject | SceneModel.createObject}
 *
 * See usage in:
 *
 * * [@xeokit/scratchmodel](/docs/modules/_xeokit_scratchmodel.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 */
export interface SceneObject {

    /**
     * Unique ID of this SceneObject.
     */
    readonly id: string;

    /**
     * The {@link Mesh | Meshes} belonging to this SceneObject.
     */
    readonly meshes: Mesh[];
}
