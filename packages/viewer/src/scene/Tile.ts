

import type {SceneObject} from "./SceneObject";
import type {SceneModel} from "./SceneModel";
import type {Tiles} from "./Tiles";
import {FloatArrayParam} from "@xeokit/math/math";
import {collapseAABB3} from "@xeokit/math/boundaries";

/**
 * A tile within the {@link Viewer}'s relative-to-center (RTC) World-space 3D coordinate system.
 *
 * * Stored in {@link Tiles.tiles}.
 * * Created and destroyed automatically as {@link SceneModel|SceneModels} are created and destroyed.
 */
export class Tile {

    /**
     * ID of this Tile.
     */
    public readonly id: string;

    /**
     * The {@link Tiles} this Tile belongs to.
     */
    public readonly tiles: Tiles;

    /**
     * The 3D World-space center of this tile.
     */
    public readonly origin: FloatArrayParam;

    /**
     * The 3D axis-aligned World-space boundary of this tile.
     */
    public readonly aabb: FloatArrayParam;

    /**
     * The {@link SceneModel|SceneModels} in this tile.
     */
    public readonly sceneModels: { [key: string]: SceneModel }

    /**
     * The {@link SceneObject|SceneObjects} in this tile.
     */
    public readonly sceneObjects: { [key: string]: SceneObject }

    /**
     * The number of {@link SceneObject|SceneObjects} in this tile.
     */
    // public numContainedSceneObjects: number;
    //
    // public numSceneModels: number;

    public useCount: number;


    /**
     * @private
     */
    constructor(tiles: Tiles, id: string, origin: FloatArrayParam) {
        this.id = id;
        this.tiles = tiles;
        this.aabb = collapseAABB3();
        this.origin = new Float64Array(origin);
        this.useCount = 0;
        this.sceneModels = {};
        this.sceneObjects = {};

    }

    registerSceneObject(sceneObject: SceneObject) {
        const sceneModel = sceneObject.model;
        if (!this.sceneModels[sceneModel.id]) {
            sceneModel.onDestroyed.one( () => {
                delete this.sceneModels[sceneModel.id];
              //  this.numSceneModels--;
            });
        }
    }

    release() {
        this.tiles.putTile(this);
    }
}