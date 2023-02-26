import type {Mesh} from "./Mesh";
import type {RendererObject} from "./RendererObject";
import type {FloatArrayParam} from "@xeokit/math/math";

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

    /**
     * Gets the axis-aligned 3D World-space boundary of this SceneObject.
     */
    get aabb(): FloatArrayParam ;

    /**
     *  Internal interface through which a {@link SceneObject} can load property updates into a renderer.
     *
     *  This is defined while the owner {@link SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObject?: RendererObject;
}


