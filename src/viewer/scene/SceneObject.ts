import {Scene} from "./Scene";
import * as math from "../math/";
import {SceneModel} from "./SceneModel";
import {Component} from "../Component";

/**
 * Geometric representation of an object within a {@link Viewer}.
 *
 * ## Overview
 *
 * * Belongs to a {@link SceneModel}, which belongs to a {@link Scene}
 * * Created with {@link SceneModel.createSceneObject}
 * * Registered by {@link Component.id} in {@link SceneModel.sceneObjects} and {@link Scene.sceneObjects}
 * * Automatically represented by a {@link ViewObject} in each existing {@link View}
 */
export abstract class SceneObject extends Component {

    /**
     * The Scene that contains this SceneObject.
     */
    readonly scene: Scene;

    /**
     * The SceneModel that contains this SceneObject.
     */
    readonly sceneModel: SceneModel;

    /**
     * The axis-aligned World-space 3D boundary of this SceneObject.
     */
    readonly aabb: math.FloatArrayType;

    /**
     * @private
     */
    protected constructor(sceneModel: SceneModel, cfg: {
        id?: string
    }) {
        super(sceneModel, cfg);
        //this.id = cfg.id || createUUID();
        this.scene = sceneModel.scene;
        this.aabb = math.AABB3();
        this.scene.addSceneObject(this);
        sceneModel.addSceneObject(this);
    }

    /**
     * @private
     */
    abstract setVisible(viewIndex: number, visible: boolean): void ;

    /**
     * @private
     */
    abstract setCulled(viewIndex: number, culled: boolean): void ;

    /**
     * @private
     */
    abstract setHighlighted(viewIndex: number, highlighted: boolean): void;

    /**
     * @private
     */
    abstract setSelected(viewIndex: number, selected: boolean): void ;

    /**
     * @private
     */
    abstract setXRayed(viewIndex: number, xrayed: boolean): void;

    /**
     * @private
     */
    abstract setEdges(viewIndex: number, edges: boolean): void ;

    /**
     * @private
     */
    abstract setColorize(viewIndex: number, colorize?: math.FloatArrayType): void;

    /**
     * @private
     */
    abstract setOpacity(viewIndex: number, opacity?: number): void ;

    /**
     * @private
     */
   abstract setPickable(viewIndex: number, pickable: boolean): void;

    /**
     * @private
     */
    destroy() {
        this.scene.removeSceneObject(this);
        super.destroy();
    }
}

