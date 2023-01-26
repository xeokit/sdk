import type { FloatArrayParam } from "../math/math";
import type { ViewerObject } from "./ViewerObject";
import type { ViewerModel } from "./ViewerModel";
import type { Tiles } from "./Tiles";
/**
 * A tile within the {@link WebViewer}'s relative-to-center (RTC) World-space 3D coordinate system.
 *
 * * Stored in {@link Tiles.tiles}.
 * * Created and destroyed automatically as {@link ViewerModel|ViewerModels} are created and destroyed.
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
     * The {@link ViewerModel|ViewerModels} in this tile.
     */
    readonly viewerModels: {
        [key: string]: ViewerModel;
    };
    /**
     * The {@link ViewerObject|ViewerObjects} in this tile.
     */
    readonly viewerObjects: {
        [key: string]: ViewerObject;
    };
    /**
     * The number of {@link ViewerObject|ViewerObjects} in this tile.
     */
    useCount: number;
    /**
     * @private
     */
    constructor(tiles: Tiles, id: string, origin: FloatArrayParam);
    registerSceneObject(viewerObject: ViewerObject): void;
    release(): void;
}
