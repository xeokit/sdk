import {FloatArrayParam} from "../math/math";
import {Component} from "../Component";
import {Scene} from "./Scene";
import {Tile} from "./Tile";

/**
 * The {@link Tile}s within a {@link Scene}.
 *
 * * Located at {@link Scene.tiles}
 * * Contains {@link Tile}s
 */
class Tiles extends Component {

    /**
     * The owner Scene.
     */
    readonly scene: Scene;

    /** The {@link Tile}s.
     */
    public readonly tiles: {[key: string]: Tile };

    /**
     * @private
     * @param scene
     */
    constructor(scene: Scene) {
        super(scene);
        this.scene = scene;
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
    getTile(origin: FloatArrayParam): Tile {
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