import {FloatArrayType} from "../math/math";
import {Component} from "../Component";
import {Scene} from "./Scene";
import {Tile} from "./Tile";
import {SceneModel} from "./SceneModel";

/**
 * The {@link Tile}s within a {@link Scene}.
 *
 * * Located at {@link Scene.tiles}
 * * Contains {@link Tile}s
 */
export class Tiles extends Component {

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
     * Creates a {@link Tile} with the given 3D World-space boundary, if not already existing.
     * @param cfg
     */
    createTile(cfg: { aabb: FloatArrayType }): Tile {
        const tile = new Tile(this, {aabb: cfg.aabb});
        return tile;
    }

    /**
     * Finds the tile that intersects the given 3D World-space position, if any.
     * @param worldPos A 3D World-space position.
     * @returns The intersecting {@link Tile}, if any, else null.
     */
    findTile(worldPos: FloatArrayType): Tile {
        return null;
    }
}