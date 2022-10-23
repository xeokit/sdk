import {Component} from "../../../viewer/Component";
import {Scene} from "../../../viewer/scene/Scene";

/**
 * A transformation within a {@link SceneModel}.
 *
 * * Created with {@link SceneModel.createTransform}
 */
export class Transform extends Component {

    /**
     * @private
     * @param scene
     * @param options
     */
    constructor(scene: Scene, options: {}) {
        super(scene, options);
    }
}