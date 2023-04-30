import type { FloatArrayParam } from "@xeokit/math";
import type { RendererMeshImpl } from "./RendererMeshImpl";
import type { RendererViewObject } from "viewer/src/RendererViewObject";
import type { RendererModel, RendererObject, SceneModel, SceneObject } from "@xeokit/scene";
/**
 * @private
 */
export declare class RendererObjectImpl implements RendererObject, RendererViewObject {
    #private;
    readonly id: string;
    readonly model: SceneModel;
    readonly sceneObject: SceneObject;
    readonly layerId: string | null;
    readonly rendererMeshes: RendererMeshImpl[];
    constructor(params: {
        id: string;
        rendererModel: RendererModel;
        rendererMeshes: RendererMeshImpl[];
        aabb: any;
        layerId?: string;
    });
    get aabb(): FloatArrayParam;
    setVisible(viewIndex: number, visible: boolean): void;
    setHighlighted(viewIndex: number, highlighted: boolean): void;
    setXRayed(viewIndex: number, xrayed: boolean): void;
    setSelected(viewIndex: number, selected: boolean): void;
    setEdges(viewIndex: number, edges: boolean): void;
    setCulled(viewIndex: number, culled: boolean): void;
    setClippable(viewIndex: number, clippable: boolean): void;
    setCollidable(viewIndex: number, collidable: boolean): void;
    setPickable(viewIndex: number, pickable: boolean): void;
    setColorize(viewIndex: number, color?: FloatArrayParam): void;
    setOpacity(viewIndex: number, opacity?: number): void;
    setOffset(viewIndex: number, offset: FloatArrayParam): void;
    build(): void;
    finalize2(): void;
    destroy(): void;
}
