import {Component} from "../Component";
import {Scene} from "./Scene";

/**
 * A transformation within a {@link SceneModel}.
 */
export class SceneTransform extends Component {

    /**
     * @private
     * @param scene
     * @param options
     */
    constructor(scene: Scene, options: {}) {
        super(scene, options);
    }
}