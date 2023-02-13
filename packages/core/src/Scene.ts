import type {XKTObject} from "./XKTObject";
import type {Model} from "@xeokit/core/components";
import type {ModelParams} from "./ModelParams";

/**
 * A model representation.
 */
export interface Scene {

    /**
     * The Scene's ID.
     */
    readonly id: string;

    /**
     * The Models in this Scene.
     */
    models: { [key: string]: Model };

    /**
     * Objects in this Scene.
     */
    objects: { [key: string]: XKTObject };

    /**
     * Creates a new {@link @xeokit/core/components!Model | Model} within this Scene.
     *
     * @param params Model configuration
     */
    createModel(params: ModelParams): Model;

    /**
     * The 3D axis-aligned World-space boundary of this Scene.
     *
     * Contains the boundaries of all contained Models that have been built so far (see {@link Model.build | Model.build}.
     */
    get aabb(): Float64Array;

    /**
     * Destroys this Scene.
     *
     @throws {Error} If Scene has already been destroyed.
     */
    destroy(): void;
}