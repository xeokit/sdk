import type { ViewerModel } from "./ViewerModel";
import type { FloatArrayParam } from "../math/math";
/**
 * GeometryImpl and materials for an object in a {@link ViewerModel}.
 *
 * See {@link Scene} for usage examples.
 *
 * ## Summary
 *
 * * Created with {@link ViewerModel.createObject}
 * * Stored in {@link ViewerModel.objects} and {@link Scene.objects}
 * * Automatically proxied by a {@link ViewObject} in each {@link View}
 */
export interface ViewerObject {
    /**
     * The {@link ViewerModel} that contains this ViewerObject.
     */
    readonly model: ViewerModel;
    /**
     * Unique ID of this ViewerObject.
     */
    readonly id: string;
    /**
     * Which {@link ViewLayer} this ViewerObject belongs to.
     */
    readonly viewLayerId: string | null;
    /**
     * The axis-aligned World-space 3D boundary of this ViewerObject.
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
