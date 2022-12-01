import {Scene} from "./Scene";
import {SceneModel} from "./SceneModel";
import {FloatArrayParam} from "../math/math";

/**
 * Geometry and material for an object within a {@link Viewer}.
 *
 * ## Overview
 *
 * * Belongs to a {@link SceneModel}, which belongs to a {@link Scene}
 * * Created with {@link SceneModel.createObject}
 * * Registered by {@link SceneModel.id} in {@link SceneModel.sceneObjects} and {@link Scene.sceneObjects}
 * * Has a corresponding {@link ViewObject} in each of the {@link Viewer}'s {@link View}s
 * * Can have a corresponding {@link DataObject} in the {@link Viewer}'s {@link Data}
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
    readonly viewLayer: string ;

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

