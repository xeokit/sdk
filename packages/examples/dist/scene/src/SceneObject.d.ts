import type { SceneMesh } from "./SceneMesh";
import type { FloatArrayParam } from "@xeokit/math";
import type { RendererObject } from "./RendererObject";
import type { SceneModel } from "./SceneModel";
/**
 * An object in a {@link @xeokit/scene!SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.objects | SceneModel.objects} and {@link @xeokit/scene!Scene.objects | Scene.objects}
 * * Created with {@link @xeokit/scene!SceneModel.createObject | SceneModel.createObject}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export declare class SceneObject {
    #private;
    /**
     * The {@link @xeokit/scene!SceneModel} that contains this SceneObject.
     */
    readonly model: SceneModel;
    /**
     * Unique ID of this SceneObject.
     *
     * SceneObjects are stored by ID in {@link @xeokit/scene!Scene.objects | Scene.objects}
     * and {@link @xeokit/scene!SceneModel.objects | SceneModel.objects}.
     */
    readonly id: string;
    /**
     * The {@link @xeokit/scene!SceneMesh | Meshes} belonging to this SceneObject.
     */
    readonly meshes: SceneMesh[];
    /**
     * Optional layer ID for this SceneObject.
     */
    readonly layerId?: string;
    /**
     *  Internal interface through which a {@link @xeokit/scene!SceneObject} can load property updates into a renderers.
     *
     *  This is defined while the owner {@link @xeokit/scene!SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObject: RendererObject | null;
    /**
     * @private
     */
    constructor(cfg: {
        model: SceneModel;
        meshes: SceneMesh[];
        id: string;
        layerId?: string;
    });
    /**
     * Gets the axis-aligned 3D World-space boundary of this SceneObject.
     */
    get aabb(): FloatArrayParam;
    /**
     * @private
     */
    setAABBDirty(): void;
}
