import type {XKTObject} from "./XKTObject";
import type {Model} from "@xeokit/core/components";
import type {ModelParams} from "./ModelParams";
import type {EventEmitter} from "./EventEmitter";


/**
 * A scene representation.
 *
 * A Scene is a container of {@link Model | Models} and {@link XKTObject | XKTObjects}.
 */
export interface Scene {

    /**
     * The Scene's ID.
     */
    readonly id: string;

    /**
     * The Models in this Scene.
     */
    readonly models: { [key: string]: Model };

    /**
     * Objects in this Scene.
     */
    readonly objects: { [key: string]: XKTObject };

    /**
     * Emits an event each time a {@link Model} is created in this Scene.
     *
     * @event
     */
    readonly onModelCreated: EventEmitter<Scene, Model>;

    /**
     * Emits an event each time a {@link Model} is destroyed in this Scene.
     *
     * @event
     */
    readonly onModelDestroyed: EventEmitter<Scene, Model>;

    /**
     * Creates a new {@link @xeokit/core/components!Model | Model} within this Scene.
     *
     * @param params Model configuration
     */
    createModel(params: ModelParams): Model;

    /**
     * Destroys this Scene.
     *
     * @throws {Error} If Scene has already been destroyed.
     */
    destroy(): void;
}