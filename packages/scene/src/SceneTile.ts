import {Scene} from "./Scene";
import {FloatArrayParam} from "@xeokit/math";
import {SceneModel} from "./SceneModel";
import {SceneObject} from "./SceneObject";

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

    /**
     * The {@link @xeokit/scene!SceneModel | SceneModels} belonging to this SceneTile, each keyed to
     * its {@link @xeokit/scene!SceneModel.id | SceneModel.id}.
     *
     * A SceneModel can belong to more than one SceneTile.
     */
    public readonly models: { [key: string]: SceneModel };

    /**
     * The {@link @xeokit/scene!SceneObject | SceneObjects} in this TiSceneTilele,
     * mapped to {@link @xeokit/scene!SceneObject.id | SceneObject.id}.
     *
     * A SceneObject can belong to more than one SceneTile.
     */
    public readonly objects: { [key: string]: SceneObject };

    constructor(scene: Scene, id: string, origin: FloatArrayParam) {
        this.scene = scene;
        this.id = id;
        this.origin = origin;
        this.numObjects = 0;
        this.models = {};
        this.objects = {};
    }
}
