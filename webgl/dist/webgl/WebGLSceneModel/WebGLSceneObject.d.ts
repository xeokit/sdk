import { ViewerObject, ViewerModel, math } from "../../viewer/index";
import type { Mesh } from "./Mesh";
declare class WebGLSceneObject implements ViewerObject {
    #private;
    /**
     * Unique ID of this ViewerObject.
     */
    readonly id: string;
    /**
     * The ViewerModel that contains this ViewerObject.
     */
    readonly model: ViewerModel;
    /**
     * Which {@link ViewLayer} this ViewerObject belongs to.
     */
    readonly viewLayerId: string | null;
    constructor(params: {
        id: string;
        viewerModel: ViewerModel;
        meshes: Mesh[];
        aabb: any;
        viewLayerId?: string;
    });
    get aabb(): math.FloatArrayParam;
    setVisible(viewIndex: number, visible: boolean): void;
    setHighlighted(viewIndex: number, highlighted: boolean): void;
    setXRayed(viewIndex: number, xrayed: boolean): void;
    setSelected(viewIndex: number, selected: boolean): void;
    setEdges(viewIndex: number, edges: boolean): void;
    setCulled(viewIndex: number, culled: boolean): void;
    setClippable(viewIndex: number, clippable: boolean): void;
    setCollidable(viewIndex: number, collidable: boolean): void;
    setPickable(viewIndex: number, pickable: boolean): void;
    setColorize(viewIndex: number, color?: math.FloatArrayParam): void;
    setOpacity(viewIndex: number, opacity?: number): void;
    setOffset(viewIndex: number, offset: math.FloatArrayParam): void;
    build(): void;
    finalize2(): void;
    destroy(): void;
}
export { WebGLSceneObject };
