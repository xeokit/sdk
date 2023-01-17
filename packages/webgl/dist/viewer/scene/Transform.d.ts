import type { SceneModel } from "./SceneModel";
/**
 * A transformation within a {@link SceneModel}.
 *
 * * Created with {@link SceneModel.createTransform}
 */
export declare class Transform {
    constructor(params: {
        sceneModel: SceneModel;
        parent?: Transform;
    });
}
