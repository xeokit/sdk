import {Component} from "../Component";
import {Scene} from "./Scene";

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