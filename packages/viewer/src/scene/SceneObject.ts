
import type {Scene} from "./Scene";
import type {SceneModel} from "./SceneModel";
import {FloatArrayParam} from "@xeokit/math/math";


/**
 * Geometry and materials for an object in a {@link SceneModel}.
 *
 * See {@link Scene} for usage examples.
 *
 * ## Summary
 *
 * * Created with {@link SceneModel.createObject}
 * * Stored in {@link SceneModel.objects} and {@link Scene.objects}
 * * Automatically proxied by a {@link ViewObject} in each {@link View}
 */
export interface SceneObject {

    /**
     * The {@link SceneModel} that contains this SceneObject.
     */
    readonly model: SceneModel;

    /**
     * Unique ID of this SceneObject.
     */
    readonly id: string;

    /**
     * Which {@link ViewLayer} this SceneObject belongs to.
     */
    readonly viewLayerId: string | null;

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

