import {Scene} from "./Scene";
import {SceneModel} from "./SceneModel";
import {FloatArrayParam} from "../math/math";

/**
 * Geometric representation of an object in a viewer.
 *
 * ## Summary
 *
 * * Contained in a {@link SceneModel}
 * * Created with {@link SceneModel.createObject}
 * * Registered in {@link SceneModel.objects} and {@link Scene.objects}
 * * Has a {@link ViewObject} in each {@link View}
 */
export interface SceneObject {

    /**
     * The SceneModel that contains this SceneObject.
     */
    readonly model: SceneModel;

    /**
     * Unique ID of this SceneObject.
     */
    readonly id: string ;

    /**
     * Which {@link ViewLayer} this SceneObject belongs to.
     */
    readonly viewLayerId: string ;

    /**
     * The axis-aligned World-space 3D boundary of this SceneObject.
     */
    readonly aabb: FloatArrayParam;

    /**
     * @private
     */
    setVisible(viewIndex: number, visible: boolean): void;

    /**
     * @private
     */
    setHighlighted(viewIndex: number, highlighted: boolean): void;

    /**
     * @private
     */
    setXRayed(viewIndex: number, xrayed: boolean): void;

    /**
     * @private
     */
    setSelected(viewIndex: number, selected: boolean): void;

    /**
     * @private
     */
    setEdges(viewIndex: number, edges: boolean): void;

    /**
     * @private
     */
    setCulled(viewIndex: number, culled: boolean): void;

    /**
     * @private
     */
    setClippable(viewIndex: number, clippable: boolean): void;

    /**
     * @private
     */
    setCollidable(viewIndex: number, collidable: boolean): void;

    /**
     * @private
     */
    setPickable(viewIndex: number, pickable: boolean): void;

    /**
     * @private
     */
    setColorize(viewIndex: number, color?: FloatArrayParam): void;

    /**
     * @private
     */
    setOpacity(viewIndex: number, opacity?: number): void;

    /**
     * @private
     */
    setOffset(viewIndex: number, offset: FloatArrayParam): void;
}

