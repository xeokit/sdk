import {Scene} from "./Scene";
import {FloatArrayParam} from "@xeokit/math";

/**
 * A tile in a {@link @xeokit/scene!SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.tiles | SceneModel.tiles}
 * * Created with {@link @xeokit/scene!SceneModel.createTile | SceneModel.createTile}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneTile {

    public readonly scene: Scene;
    public readonly id: string;
    public readonly origin: FloatArrayParam;
    public numObjects: number;

    constructor(scene: Scene, id: string, origin: FloatArrayParam) {
        this.scene = scene;
        this.id = id;
        this.origin = origin;
        this.numObjects = 0;
    }
}
