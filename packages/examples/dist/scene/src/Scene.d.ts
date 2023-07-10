import { Component, EventEmitter, SDKError } from "@xeokit/core";
import { type FloatArrayParam } from "@xeokit/math";
import { SceneModel } from "./SceneModel";
import type { SceneObject } from "./SceneObject";
import type { SceneModelParams } from "./SceneModelParams";
/**
 * A scene representation.
 *
 * A Scene is a container of {@link SceneModel | SceneModels} and {@link SceneObject | SceneObjects}.
 */
export declare class Scene extends Component {
    #private;
    /**
     * The {@link @xeokit/scene!SceneModel | SceneModels} belonging to this Scene, each keyed to
     * its {@link @xeokit/scene!SceneModel.id | SceneModel.id}.
     */
    readonly models: {
        [key: string]: SceneModel;
    };
    /**
     * The {@link SceneObject | SceneObjects} in this Scene, mapped to {@link SceneObject.id | SceneObject.id}.
     */
    readonly objects: {
        [key: string]: SceneObject;
    };
    /**
     * Emits an event each time a {@link SceneModel} is created in this Scene.
     *
     * @event
     */
    readonly onModelCreated: EventEmitter<Scene, SceneModel>;
    /**
     * Emits an event each time a {@link SceneModel} is destroyed in this Scene.
     *
     * @event
     */
    readonly onModelDestroyed: EventEmitter<Scene, SceneModel>;
    /**
     * Creates a new Scene.
     *
     * See {@link "@xeokit/scene"} for usage.
     */
    constructor();
    /**
     * Gets the collective World-space 3D center of all the {@link SceneModel | SceneModels} in this Scene.
     */
    get center(): Float64Array;
    /**
     * Gets the collective World-space 3D [axis-aligned boundary](/docs/pages/GLOSSARY.html#aabb) of all the {@link SceneModel | SceneModels} in this Scene.
     *
     * The boundary will be of the form ````[xMin, yMin, zMin, xMax, yMax, zMax]````.
     */
    get aabb(): FloatArrayParam;
    /**
     * Creates a new {@link @xeokit/scene!SceneModel} in this Scene.
     *
     * Remember to call {@link SceneModel.build | SceneModel.build} when you've finished building or loading the SceneModel. That will
     * fire events via {@link Scene.onModelCreated | Scene.onModelCreated} and {@link SceneModel.onBuilt | SceneModel.onBuilt}, to
     * indicate to any subscribers that the SceneModel is built and ready for use.
     *
     * See {@link "@xeokit/scene"} for more details on usage.
     *
     * @param  sceneModelParams Creation parameters for the new {@link @xeokit/scene!SceneModel}.
     * @returns *{@link SceneModel}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * This Scene has already been destroyed.
     * * A SceneModel with the given ID already exists in this Scene.
     */
    createModel(sceneModelParams: SceneModelParams): SceneModel | SDKError;
    /**
     * @private
     */
    setAABBDirty(): void;
    /**
     * Destroys all contained {@link SceneModel | SceneModels}.
     *
     * * Fires {@link Scene.onModelDestroyed | Scene.onModelDestroyed} and {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
     * for each existing SceneModel in this Scene.
     *
     * See {@link "@xeokit/scene"} for usage.
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * This Scene has already been destroyed.
     */
    clear(): void | SDKError;
    /**
     * Destroys this Scene and all contained {@link SceneModel | SceneModels}.
     *
     * * Fires {@link Scene.onModelDestroyed | Scene.onModelDestroyed} and {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
     * for each existing SceneModels in this Data.
     * * Unsubscribes all subscribers to {@link Scene.onModelCreated | Scene.onModelCreated}, {@link Scene.onModelDestroyed | Scene.onModelDestroyed}, {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
     *
     * See {@link "@xeokit/scene"} for usage.
     *
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * This Scene has already been destroyed.
     */
    destroy(): void | SDKError;
}
