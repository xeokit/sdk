import {Scene} from "./Scene";
import * as math from "../math/";
import {SceneModel} from "./SceneModel";
import {ENTITY_FLAGS} from "./webgl/WebGLVBOSceneModel/lib/ENTITY_FLAGS";

/**
 * An object in a {@link SceneModel}.
 *
 * ## Overview
 *
 * * Belongs to a {@link SceneModel}, which belongs to a {@link Scene}
 * * Created with {@link SceneModel.createSceneObject}
 * * Registered by {@link SceneModel.id} in {@link SceneModel.sceneObjects} and {@link Scene.sceneObjects}
 * * Has a corresponding {@link ViewObject} in each of the {@link Viewer}'s {@link View}s
 * * Can have a corresponding {@link DataObject} in the {@link Viewer}'s {@link Data}
 */
export interface SceneObject {

    /**
     * Unique ID of this SceneObject.
     */
    readonly id: string | number;

    /**
     * The SceneModel that contains this SceneObject.
     */
    readonly sceneModel: SceneModel;

    /**
     * The axis-aligned World-space 3D boundary of this SceneObject.
     */
    readonly aabb: math.FloatArrayType;

    /**
     *
     * @param viewIndex
     * @param visible
     */
    setVisible(viewIndex: number, visible: boolean): void;

    setHighlighted(viewIndex: number, highlighted: boolean): void;

    setXRayed(viewIndex: number, xrayed: boolean): void;

    setSelected(viewIndex: number, selected: boolean): void;

    setEdges(viewIndex: number, edges: boolean): void;

    setCulled(viewIndex: number, culled: boolean): void;

    setClippable(viewIndex: number, clippable: boolean): void;

    setCollidable(viewIndex: number, collidable: boolean): void;

    setPickable(viewIndex: number, pickable: boolean): void;

    setColorize(viewIndex: number, color?: math.FloatArrayType): void;

    setOpacity(viewIndex: number, opacity?: number): void;

    setOffset(viewIndex: number, offset: math.FloatArrayType): void;

}

