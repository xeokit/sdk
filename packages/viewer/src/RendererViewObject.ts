
import {FloatArrayParam} from "@xeokit/math/math";
import { SceneModel} from "@xeokit/scene";


/**
 * Interface through which a {@link @xeokit/viewer!Viewer | Viewer} can issue commands at a {@link @xeokit/viewer!Renderer | Renderer} to
 * show/hide/highlight/select/xray/colorize a particular object within the specified {@link @xeokit/viewer!View | View}.
 *
 * @internal
 */
export interface RendererViewObject {

    /**
     * Unique ID of this RendererViewObjectCommands.
     */
    readonly id: string;

    /**
     * The {@link @xeokit/scene!SceneModel | SceneModel} that contains this RendererViewObjectCommands.
     */
    readonly model: SceneModel;

    /**
     * The axis-aligned World-space 3D boundary of this RendererViewObjectCommands.
     */
    readonly aabb: FloatArrayParam;

    /**
     * The ID of a {@link @xeokit/viewer!ViewLayer | ViewLayer} for the object to exclusively appear in.
     */
    readonly viewLayerId: string | null;

    /**
     * TODO
     */
    setVisible(viewIndex: number, visible: boolean): void;

    /**
     * TODO
     */
    setHighlighted(viewIndex: number, highlighted: boolean): void;

    /**
     * TODO
     */
    setXRayed(viewIndex: number, xrayed: boolean): void;

    /**
     * TODO
     */
    setSelected(viewIndex: number, selected: boolean): void;

    /**
     * TODO
     */
    setEdges(viewIndex: number, edges: boolean): void;

    /**
     * TODO
     */
    setCulled(viewIndex: number, culled: boolean): void;

    /**
     * TODO
     */
    setClippable(viewIndex: number, clippable: boolean): void;

    /**
     * TODO
     */
    setCollidable(viewIndex: number, collidable: boolean): void;

    /**
     * TODO
     */
    setPickable(viewIndex: number, pickable: boolean): void;

    /**
     * TODO
     */
    setColorize(viewIndex: number, color?: FloatArrayParam): void;

    /**
     * TODO
     */
    setOpacity(viewIndex: number, opacity?: number): void;

    /**
     * TODO
     */
    setOffset(viewIndex: number, offset: FloatArrayParam): void;
}

