import {Component} from "../Component";
import {SceneModel} from "./SceneModel";

/**
 * A transformation within a {@link SceneModel}.
 *
 * * Created with {@link SceneModel.createTransform}
 */
export class Transform extends Component {

    constructor(params: { sceneModel: SceneModel, parent?: Transform }) {
        super();
    }
}