import { Component, EventEmitter, SDKError } from "../core";
import { MAX_DOUBLE, MIN_DOUBLE } from "../math";
import { EventDispatcher } from "strongly-typed-events";
import { SceneModel } from "./SceneModel";
import { createAABB3 } from "../boundaries";
import { SceneTile } from "./SceneTile";
/**
 * Container of model geometry and materials.
 *
 * A Scene contains {@link scene!SceneModel | SceneModels}, {@link scene!SceneObject | SceneObjects},
 *  {@link scene!SceneMesh | SceneMeshes}, {@link scene!SceneGeometry | SceneGeometries},
 *  {@link scene!SceneTextureSet | SceneTextureSets} and {@link scene!SceneTexture | SceneTextures}.
 *
 * See {@link scene | @xeokit/sdk/scene}  for usage.
 */
export class Scene extends Component {
    /**
     * The {@link scene!SceneModel | SceneModels} belonging to this Scene, each keyed to
     * its {@link scene!SceneModel.id | SceneModel.id}.
     */
    models;
    /**
     * The {@link scene!SceneObject | SceneObjects} in this Scene, mapped to {@link scene!SceneObject.id | SceneObject.id}.
     */
    objects;
    /**
     * The {@link scene!SceneTile | Tiles} in this Scene
     */
    tiles;
    /**
     * Emits an event each time a {@link scene!SceneModel | SceneModel} is created in this Scene.
     *
     * @event
     */
    onModelCreated;
    /**
     * Emits an event each time a {@link scene!SceneModel | SceneModel} is destroyed in this Scene.
     *
     * @event
     */
    onModelDestroyed;
    /**
     * Emits an event each time a {@link scene!SceneTile} is created in this Scene.
     *
     * @event
     */
    onTileCreated;
    /**
     * Emits an event each time a {@link scene!SceneTile | SceneTile} is destroyed in this Scene.
     *
     * @event
     */
    onTileDestroyed;
    #onModelBuilts;
    #onModelDestroys;
    #center;
    #aabbDirty;
    #aabb;
    /**
     * Creates a new Scene.
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
        this.onModelCreated = new EventEmitter(new EventDispatcher());
        this.onModelDestroyed = new EventEmitter(new EventDispatcher());
        this.onTileCreated = new EventEmitter(new EventDispatcher());
        this.onTileDestroyed = new EventEmitter(new EventDispatcher());
    }
    /**
     * Gets the collective World-space 3D center of all the {@link scene!SceneModel | SceneModels} in this Scene.
     */
    get center() {
        if (this.#aabbDirty) {
            const aabb = this.aabb; // Lazy-build
            this.#center[0] = (aabb[0] + aabb[3]) / 2;
            this.#center[1] = (aabb[1] + aabb[4]) / 2;
            this.#center[2] = (aabb[2] + aabb[5]) / 2;
        }
        return this.#center;
    }
    /**
     * Gets the collective World-space 3D [axis-aligned boundary](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#aabb) of all the {@link scene!SceneModel | SceneModels} in this Scene.
     *
     * The boundary will be of the form ````[xMin, yMin, zMin, xMax, yMax, zMax]````.
     */
    get aabb() {
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
     * Creates a new {@link scene!SceneModel | SceneModel} in this Scene.
     *
     * Remember to call {@link scene!SceneModel.build | SceneModel.build} when you've finished building or
     * loading the SceneModel. That will
     * fire events via {@link scene!Scene.onModelCreated | Scene.onModelCreated} and {@link scene!SceneModel.onBuilt | SceneModel.onBuilt}, to
     * indicate to any subscribers that the SceneModel is built and ready for use.
     *
     * See {@link "@xeokit/scene" | @xeokit/scene}  for more details on usage.
     *
     * @param  sceneModelParams Creation parameters for the new {@link scene!SceneModel | SceneModel}.
     * @returns *{@link scene!SceneModel | SceneModel}*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * This Scene has already been destroyed.
     * * A SceneModel with the given ID already exists in this Scene.
     */
    createModel(sceneModelParams) {
        if (this.destroyed) {
            return new SDKError("Scene already destroyed");
        }
        const id = sceneModelParams.id;
        if (this.models[id]) {
            return new SDKError(`SceneModel already created in this Scene: ${id}`);
        }
        const sceneModel = new SceneModel(this, sceneModelParams);
        this.models[id] = sceneModel;
        sceneModel.onDestroyed.one(() => {
            delete this.models[sceneModel.id];
            this.#deregisterObjects(sceneModel);
            this.onModelDestroyed.dispatch(this, sceneModel);
        });
        sceneModel.onBuilt.one(() => {
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
     * Destroys all contained {@link scene!SceneModel | SceneModels}.
     *
     * * Fires {@link scene!Scene.onModelDestroyed | Scene.onModelDestroyed} and
     * {@link scene!SceneModel.onDestroyed | SceneModel.onDestroyed} for each existing SceneModel in this Scene.
     *
     * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
     * @returns *void*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * This Scene has already been destroyed.
     */
    clear() {
        if (this.destroyed) {
            return new SDKError("Scene already destroyed");
        }
        for (let id in this.models) {
            this.models[id].destroy();
        }
    }
    /**
     * Destroys this Scene and all contained {@link scene!SceneModel | SceneModels}.
     *
     * * Fires {@link scene!Scene.onModelDestroyed | Scene.onModelDestroyed} and {@link scene!SceneModel.onDestroyed | SceneModel.onDestroyed}
     * for each existing SceneModels in this Data.
     * * Unsubscribes all subscribers to {@link scene!Scene.onModelCreated | Scene.onModelCreated}, {@link scene!Scene.onModelDestroyed | Scene.onModelDestroyed}, {@link scene!SceneModel.onDestroyed | SceneModel.onDestroyed}
     *
     * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
     *
     * @returns *void*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * This Scene has already been destroyed.
     */
    destroy() {
        this.clear();
        this.onModelCreated.clear();
        this.onModelDestroyed.clear();
        this.onTileCreated.clear();
        this.onTileDestroyed.clear();
        super.destroy();
    }
    #registerObjects(model) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            this.objects[object.id] = object;
        }
        this.#aabbDirty = true;
    }
    #deregisterObjects(model) {
        const objects = model.objects;
        for (let id in objects) {
            const object = objects[id];
            delete this.objects[object.id];
        }
        this.#aabbDirty = true;
    }
    getTile(origin) {
        const tileId = `${origin[0]}-${origin[1]}-${origin[2]}`;
        let tile = this.tiles[tileId];
        if (tile) {
            tile.numObjects++;
        }
        else {
            tile = new SceneTile(this, tileId, origin);
            tile.numObjects = 1;
            this.tiles[tileId] = tile;
            this.onTileCreated.dispatch(this, tile);
        }
        return tile;
    }
    putTile(tile) {
        if (this.tiles[tile.id] === undefined) {
            return;
        }
        if (--tile.numObjects <= 0) {
            delete this.tiles[tile.id];
            this.onTileDestroyed.dispatch(this, tile);
        }
    }
}
//# sourceMappingURL=Scene.js.map