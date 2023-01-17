import type { FloatArrayParam } from "../math/math";
import { Component } from "../Component";
import type { Scene } from "./Scene";
import { Tile } from "./Tile";
/**
 * The {@link Tile|Tiles} within a {@link Scene}.
 *
 * * Located at {@link Scene.tiles}
 * * Contains {@link Tile|Tiles}
 */
declare class Tiles extends Component {
    /**
     * The owner Scene.
     */
    readonly scene: Scene;
    /** The {@link Tile|Tiles}.
     */
    readonly tiles: {
        [key: string]: Tile;
    };
    /**
     * @private
     * @param scene
     */
    constructor(scene: Scene);
    /**
     * Gets a Tile for the given coordinate origin.
     *
     * Make sure to release it with {@link putTile} when you no longer need it.
     *
     * @param origin The coordinate origin.
     * @returns A Tile for the origin.
     */
    getTile(origin: FloatArrayParam): Tile;
    /**
     * Releases an RTC view matrix.
     *
     * @param tile The RTC view matrix.
     */
    putTile(tile: Tile): void;
}
export { Tiles };
