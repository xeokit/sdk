
import type {Tiles} from "./Tiles";
import {FloatArrayParam} from "@xeokit/math/math";
import {collapseAABB3} from "@xeokit/math/boundaries";


/**
 * A tile within the {@link @xeokit/viewer!Viewer}'s relative-to-center (RTC) World-space 3D coordinate system.
 *
 * * Stored in {@link Tiles.tiles}.
 * * Created and destroyed automatically as {@link ViewerModel|ViewerModels} are created and destroyed.
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
     * The {@link ViewerModel|ViewerModels} in this tile.
     */
    // public readonly viewerModels: { [key: string]: ViewerModel }

    /**
     * The {@link RendererObject | ViewerObjects} in this tile.
     */
//    public readonly viewerObjects: { [key: string]: RendererObject }

    /**
     * The number of {@link RendererObject | ViewerObjects} in this tile.
     */
        // public numContainedViewerObjects: number;
        //
        // public numViewerModels: number;

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
  //      this.viewerModels = {};
  //      this.viewerObjects = {};

    }

    // registerSceneObject(viewerObject: RendererObject) {
    //     // const viewerModel = viewerObject.model;
    //     // if (!this.viewerModels[viewerModel.id]) {
    //     //     viewerModel.onDestroyed.one(() => {
    //     //         delete this.viewerModels[viewerModel.id];
    //     //         //  this.numViewerModels--;
    //     //     });
    //     // }
    // }

    release() {
        this.tiles.putTile(this);
    }
}