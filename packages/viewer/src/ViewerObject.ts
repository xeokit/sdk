import type {ViewerModel} from "./ViewerModel";
import {FloatArrayParam} from "@xeokit/math/math";
import {Mesh, XKTObject} from "@xeokit/core/components";


/**
 * GeometryImpl and materials for an object in a {@link @xeokit/viewer!ViewerModel | ViewerModel}.
 *
 * See {@link @xeokit/viewer!Viewer} for usage examples.
 *
 * ## Summary
 *
 * * Stored in {@link ViewerModel.objects} and {@link View.objects}
 * * Created with {@link ViewerModel.createObject}
 * * Automatically mirrored by a {@link ViewObject} in each {@link @xeokit/viewer!View}
 *
 * @private
 */
export interface ViewerObject extends XKTObject {

    /**
     * Unique ID of this ViewerObject.
     */
    readonly id: string;

    /**
     *
     */
    readonly meshes: Mesh[];

    /**
     * The {@link @xeokit/viewer!ViewerModel | ViewerModel} that contains this ViewerObject.
     */
    readonly model: ViewerModel;

    /**
     * The axis-aligned World-space 3D boundary of this ViewerObject.
     */
    readonly aabb: FloatArrayParam;

    /**
     * Which {@link ViewLayer} this ViewerObject belongs to.
     */
    readonly viewLayerId: string | null;

    //------------------------------------------------------------------------------------------------------------------

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

