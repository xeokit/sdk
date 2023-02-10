import type * as math from '@xeokit/math/math';
import {Component} from "@xeokit/core/components";

import {Viewer} from "./Viewer";
import {Tile} from "./Tile";

/**
 * The {@link Tile|Tiles} within a {@link @xeokit/viewer!Viewer}.
 *
 * * Located at {@link Viewer.tiles}
 * * Contains {@link Tile|Tiles}
 */
class Tiles extends Component {

    /**
     * The owner Viewer.
     */
    readonly viewer: Viewer;

    /** The {@link Tile|Tiles}.
     */
    public readonly tiles: { [key: string]: Tile };

    /**
     * @private
     * @param viewer
     */
    constructor(viewer: Viewer) {
        super(viewer);
        this.viewer = viewer;
        this.tiles = {};
    }

    /**
     * Gets a Tile for the given coordinate origin.
     *
     * Make sure to release it with {@link putTile} when you no longer need it.
     *
     * @param origin The coordinate origin.
     * @returns A Tile for the origin.
     */
    getTile(origin: math.FloatArrayParam): Tile {
        const id = `${origin[0]}-${origin[1]}-${origin[2]}`;
        let tile = this.tiles[id];
        if (!tile) {
            tile = new Tile(this, id, origin);
            this.tiles[id] = tile;
        }
        tile.useCount++;
        return tile;
    }

    /**
     * Releases an RTC view matrix.
     *
     * @param tile The RTC view matrix.
     */
    putTile(tile: Tile): void {
        tile.useCount--;
        if (tile.useCount <= 0) {
            delete this.tiles[tile.id];
        }
    }
}

export {Tiles};