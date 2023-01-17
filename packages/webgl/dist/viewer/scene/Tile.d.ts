import type { FloatArrayParam } from "../math/math";
import type { SceneObject } from "./SceneObject";
import type { SceneModel } from "./SceneModel";
import type { Tiles } from "./Tiles";
/**
 * A tile within the {@link WebViewer}'s relative-to-center (RTC) World-space 3D coordinate system.
 *
 * * Stored in {@link Tiles.tiles}.
 * * Created and destroyed automatically as {@link SceneModel|SceneModels} are created and destroyed.
 */
export declare class Tile {
    /**
     * ID of this Tile.
     */
    readonly id: string;
    /**
     * The {@link Tiles} this Tile belongs to.
     */
    readonly tiles: Tiles;
    /**
     * The 3D World-space center of this tile.
     */
    readonly origin: FloatArrayParam;
    /**
     * The 3D axis-aligned World-space boundary of this tile.
     */
    readonly aabb: FloatArrayParam;
    /**
     * The {@link SceneModel|SceneModels} in this tile.
     */
    readonly sceneModels: {
        [key: string]: SceneModel;
    };
    /**
     * The {@link SceneObject|SceneObjects} in this tile.
     */
    readonly sceneObjects: {
        [key: string]: SceneObject;
    };
    /**
     * The number of {@link SceneObject|SceneObjects} in this tile.
     */
    useCount: number;
    /**
     * @private
     */
    constructor(tiles: Tiles, id: string, origin: FloatArrayParam);
    registerSceneObject(sceneObject: SceneObject): void;
    release(): void;
}
