import {Component} from "../Component";
import {Scene} from "./Scene";
import {FloatArrayType} from "../math/math";
import {vec3} from "../math/vector";
import {getAABB3Center} from "../math/boundaries";
import {SceneObject} from "./SceneObject";
import {SceneModel} from "./SceneModel";

class Tiles {
}

/**
 * A tile within the {@link Viewer}'s relative-to-center (RTC) World-space 3D coordinate system.
 *
 * * Stored in {@link Tiles.tiles}.
 * * Created and destroyed automatically as {@link SceneModel}s are created and destroyed.
 */
export class Tile  {

    /**
     * The {@link Tiles} this Tile belongs to.
     */
    public readonly tiles: Tiles;

    /**
     * The 3D World-space center of this tile.
     */
    public readonly origin: FloatArrayType;

    /**
     * The 3D axis-aligned World-space boundary of this tile.
     */
    public readonly aabb: FloatArrayType;

    /**
     * The {@link SceneModel}s in this tile.
     */
    public readonly sceneModels: { [key: string]: SceneModel }

    /**
     * The {@link SceneObject}s in this tile.
     */
    public readonly sceneObjects: { [key: string]: SceneObject }

    /**
     * The number of {@link SceneObject}s in this tile.
     */
    public numContainedSceneObjects : number;

    public numSceneModels: number;

    /**
     * @private
     */
    constructor(tiles: Tiles, options: { aabb: FloatArrayType }) {
        this.tiles = tiles;
        this.aabb = options.aabb;
        this.origin = getAABB3Center(options.aabb);
        this.numContainedSceneObjects = 0;
        this.numSceneModels = 0;
    }

    registerSceneObject(sceneObject:SceneObject) {
        const sceneModel = sceneObject.model;
        if (!this.sceneModels[sceneModel.id]) {
            sceneModel.events.on("destroyed", ()=>{
                delete this.sceneModels[sceneModel.id];
                this.numSceneModels--;
            });
        }
    }
}