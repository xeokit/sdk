import {Component, EventEmitter, SDKError} from "@xeokit/core";
import {type FloatArrayParam, MAX_DOUBLE, MIN_DOUBLE} from "@xeokit/math";
import {EventDispatcher} from "strongly-typed-events";
import {SceneModel} from "./SceneModel";
import type {SceneObject} from "./SceneObject";
import type {SceneModelParams} from "./SceneModelParams";
import {createAABB3} from "@xeokit/boundaries";
import {SceneTile} from "./SceneTile";

/**
 * A scene representation.
 *
 * A Scene is a container of {@link @xeokit/scene!SceneModel | SceneModels} and {@link @xeokit/scene!SceneObject | SceneObjects}.
 */
export class Scene extends Component {

    /**
     * The {@link @xeokit/scene!SceneModel | SceneModels} belonging to this Scene, each keyed to
     * its {@link @xeokit/scene!SceneModel.id | SceneModel.id}.
     */
    public readonly models: { [key: string]: SceneModel };

    /**
     * The {@link @xeokit/scene!SceneObject | SceneObjects} in this Scene, mapped to {@link @xeokit/scene!SceneObject.id | SceneObject.id}.
     */
    public readonly objects: { [key: string]: SceneObject };

    /**
     * The {@link @xeokit/scene!SceneTile | Tiles} in this Scene
     */
    public readonly tiles: { [key: string]: SceneTile };

    /**
     * Emits an event each time a {@link @xeokit/scene!SceneModel} is created in this Scene.
     *
     * @event
     */
    public readonly onModelCreated: EventEmitter<Scene, SceneModel>;

    /**
     * Emits an event each time a {@link @xeokit/scene!SceneModel} is destroyed in this Scene.
     *
     * @event
     */
    public readonly onModelDestroyed: EventEmitter<Scene, SceneModel>;

    /**
     * Emits an event each time a {@link @xeokit/scene!SceneTile} is created in this Scene.
     *
     * @event
     */
    public readonly  onTileCreated:  EventEmitter<Scene, SceneTile>;

    /**
     * Emits an event each time a {@link @xeokit/scene!SceneTile} is destroyed in this Scene.
     *
     * @event
     */
    public readonly  onTileDestroyed:  EventEmitter<Scene, SceneTile>;

    #onModelBuilts: { [key: string]: any };
    #onModelDestroys: { [key: string]: any };
    #center: Float64Array;
    #aabbDirty: boolean;
    #aabb: Float64Array;

    /**
     * Creates a new Scene.
     *
     * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
     */
    constructor() {

        super(null, {});

        this.#aabb = createAABB3();
        this.#aabbDirty = true;

        this.models = {};
        this.objects = {};
        this.tiles = {};

        this.#onModelBuilts = {};
        this.#onModelDestroys = {};
        this.onModelCreated = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
        this.onModelDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
        this.onTileCreated = new EventEmitter(new EventDispatcher<Scene, SceneTile>());
        this.onTileDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneTile>());
    }

    /**
     * Gets the collective World-space 3D center of all the {@link @xeokit/scene!SceneModel | SceneModels} in this Scene.
     */
    get center(): Float64Array {
        if (this.#aabbDirty) {
            const aabb = this.aabb; // Lazy-build
            this.#center[0] = (aabb[0] + aabb[3]) / 2;
            this.#center[1] = (aabb[1] + aabb[4]) / 2;
            this.#center[2] = (aabb[2] + aabb[5]) / 2;
        }
        return this.#center;
    }

    /**
     * Gets the collective World-space 3D [axis-aligned boundary](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#aabb) of all the {@link @xeokit/scene!SceneModel | SceneModels} in this Scene.
     *
     * The boundary will be of the form ````[xMin, yMin, zMin, xMax, yMax, zMax]````.
     */
    get aabb(): FloatArrayParam {
        if (this.#aabbDirty) {
            let xmin = MAX_DOUBLE;
            let ymin = MAX_DOUBLE;
            let zmin = MAX_DOUBLE;
            let xmax = MIN_DOUBLE;
            let ymax = MIN_DOUBLE;
            let zmax = MIN_DOUBLE;
            let aabb;
            const objects = this.objects;
            let valid = false;
            for (const objectId in objects) {
                if (objects.hasOwnProperty(objectId)) {
                    const object = objects[objectId];
                    // if (object.collidable === false) {
                    //     continue;
                    // }
                    aabb = object.aabb;
                    if (aabb[0] < xmin) {
                        xmin = aabb[0];
                    }
                    if (aabb[1] < ymin) {
                        ymin = aabb[1];
                    }
                    if (aabb[2] < zmin) {
                        zmin = aabb[2];
                    }
                    if (aabb[3] > xmax) {
                        xmax = aabb[3];
                    }
                    if (aabb[4] > ymax) {
                        ymax = aabb[4];
                    }
                    if (aabb[5] > zmax) {
                        zmax = aabb[5];
                    }
                    valid = true;
                }
            }
            if (!valid) {
                xmin = -100;
                ymin = -100;
                zmin = -100;
                xmax = 100;
                ymax = 100;
                zmax = 100;
            }
            this.#aabb[0] = xmin;
            this.#aabb[1] = ymin;
            this.#aabb[2] = zmin;
            this.#aabb[3] = xmax;
            this.#aabb[4] = ymax;
            this.#aabb[5] = zmax;
            this.#aabbDirty = false;
        }
        return this.#aabb;
    }

    /**
     * Creates a new {@link @xeokit/scene!SceneModel} in this Scene.
     *
     * Remember to call {@link @xeokit/scene!SceneModel.build | SceneModel.build} when you've finished building or
     * loading the SceneModel. That will
     * fire events via {@link @xeokit/scene!Scene.onModelCreated | Scene.onModelCreated} and {@link @xeokit/scene!SceneModel.onBuilt | SceneModel.onBuilt}, to
     * indicate to any subscribers that the SceneModel is built and ready for use.
     *
     * See {@link "@xeokit/scene" | @xeokit/scene}  for more details on usage.
     *
     * @param  sceneModelParams Creation parameters for the new {@link @xeokit/scene!SceneModel}.
     * @returns *{@link @xeokit/scene!SceneModel}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError | SDKError}*
     * * This Scene has already been destroyed.
     * * A SceneModel with the given ID already exists in this Scene.
     */
    createModel(sceneModelParams: SceneModelParams): SceneModel | SDKError {
        if (this.destroyed) {
            return new SDKError("Scene already destroyed");
        }
        const id = sceneModelParams.id;
        if (this.models[id]) {
            return new SDKError(`SceneModel already created in this Scene: ${id}`);
        }
        const sceneModel = new SceneModel(this, sceneModelParams);
        this.models[id] = sceneModel;
        sceneModel.onDestroyed.one(() => { // SceneModel#destroy() called
            delete this.models[sceneModel.id];
            this.#deregisterObjects(sceneModel);
            this.onModelDestroyed.dispatch(this, sceneModel);
        });
        sceneModel.onBuilt.one(() => { // SceneModel#build() called
            this.#registerObjects(sceneModel);
            this.onModelCreated.dispatch(this, sceneModel);
        });
        return sceneModel;
    }

    /**
     * @private
     */
    setAABBDirty() {
        if (!this.#aabbDirty) {
            this.#aabbDirty = true;
            //this.events.fire("aabb", true);
        }
    }

    /**
     * Destroys all contained {@link @xeokit/scene!SceneModel | SceneModels}.
     *
     * * Fires {@link @xeokit/scene!Scene.onModelDestroyed | Scene.onModelDestroyed} and
     * {@link @xeokit/scene!SceneModel.onDestroyed | SceneModel.onDestroyed} for each existing SceneModel in this Scene.
     *
     * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError | SDKError}*
     * * This Scene has already been destroyed.
     */
    clear(): void | SDKError {
        if (this.destroyed) {
            return new SDKError("Scene already destroyed");
        }
        for (let id in this.models) {
            this.models[id].destroy();
        }
    }

    /**
     * Destroys this Scene and all contained {@link @xeokit/scene!SceneModel | SceneModels}.
     *
     * * Fires {@link @xeokit/scene!Scene.onModelDestroyed | Scene.onModelDestroyed} and {@link @xeokit/scene!SceneModel.onDestroyed | SceneModel.onDestroyed}
     * for each existing SceneModels in this Data.
     * * Unsubscribes all subscribers to {@link @xeokit/scene!Scene.onModelCreated | Scene.onModelCreated}, {@link @xeokit/scene!Scene.onModelDestroyed | Scene.onModelDestroyed}, {@link @xeokit/scene!SceneModel.onDestroyed | SceneModel.onDestroyed}
     *
     * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
     *
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError | SDKError}*
     * * This Scene has already been destroyed.
     */
    destroy(): void | SDKError {
        this.clear();
        this.onModelCreated.clear();
        this.onModelDestroyed.clear();
        this.onTileCreated.clear();
        this.onTileDestroyed.clear();
        super.destroy();
    }

    #registerObjects(model: SceneModel) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            this.objects[object.id] = <SceneObject>object;
        }
        this.#aabbDirty = true;
    }

    #deregisterObjects(model: SceneModel) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            delete this.objects[object.id];
        }
        this.#aabbDirty = true;
    }

    getTile(origin: FloatArrayParam):SceneTile {
        const tileId = `${origin[0]}-${origin[1]}-${origin[2]}`;
        let tile = this.tiles[tileId];
        if (tile) {
            tile.numObjects++;
        } else {
            tile = new SceneTile(this, tileId, origin);
            tile.numObjects = 1;
            this.tiles[tileId] = tile;
            this.onTileCreated.dispatch(this, tile);
        }
        return tile;
    }

    putTile(tile: SceneTile): void {
        if (this.tiles[tile.id] === undefined) {
            return;
        }
        if (--tile.numObjects <= 0) {
            delete this.tiles[tile.id];
            this.onTileDestroyed.dispatch(this, tile);
        }
    }


}
