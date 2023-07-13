
import type {FloatArrayParam} from "@xeokit/math";
import type { RendererModel} from "@xeokit/scene";


/**
 * Interface through which a {@link @xeokit/viewer!Viewer | Viewer} can issue commands at a
 * {@link @xeokit/viewer!Renderer | Renderer} to show/hide/highlight/select/xray/colorize a
 * particular object within the specified {@link @xeokit/viewer!View | View}.
 *
 * @internal
 */
export interface RendererViewObject {

    /**
     * Unique ID of this RendererViewObject.
     * @internal
     */
    readonly id: string;

    /**
     * The {@link @xeokit/scene!RendererModel | RendererModel} that contains this RendererViewObject.
     * @internal
     */
    readonly rendererModel: RendererModel;

    /**
     * The axis-aligned World-space 3D boundary of this RendererViewObject.
     * @internal
     */
    readonly aabb: FloatArrayParam;

    /**
     * The ID of a {@link @xeokit/viewer!ViewLayer | ViewLayer} for the object to exclusively appear in.
     * @internal
     */
    readonly layerId: string | null;

    /**
     * TODO
     * @internal
     */
    setVisible(viewIndex: number, visible: boolean): void;

    /**
     * TODO
     * @internal
     */
    setHighlighted(viewIndex: number, highlighted: boolean): void;

    /**
     * TODO
     * @internal
     */
    setXRayed(viewIndex: number, xrayed: boolean): void;

    /**
     * TODO
     * @internal
     */
    setSelected(viewIndex: number, selected: boolean): void;

    /**
     * TODO
     * @internal
     */
    setEdges(viewIndex: number, edges: boolean): void;

    /**
     * TODO
     * @internal
     */
    setCulled(viewIndex: number, culled: boolean): void;

    /**
     * TODO
     * @internal
     */
    setClippable(viewIndex: number, clippable: boolean): void;

    /**
     * TODO
     * @internal
     */
    setCollidable(viewIndex: number, collidable: boolean): void;

    /**
     * TODO
     * @internal
     */
    setPickable(viewIndex: number, pickable: boolean): void;

    /**
     * TODO
     * @internal
     */
    setColorize(viewIndex: number, color?: FloatArrayParam): void;

    /**
     * TODO
     * @internal
     */
    setOpacity(viewIndex: number, opacity?: number): void;

    /**
     * TODO
     * @internal
     */
    setOffset(viewIndex: number, offset: FloatArrayParam): void;
}

