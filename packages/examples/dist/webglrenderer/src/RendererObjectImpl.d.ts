import type { FloatArrayParam } from "@xeokit/math";
import type { RendererMeshImpl } from "./RendererMeshImpl";
import type { RendererViewObject } from "@xeokit/viewer";
import type { RendererModel, RendererObject, SceneObject } from "@xeokit/scene";
/**
 * @private
 */
export declare class RendererObjectImpl implements RendererObject, RendererViewObject {
    #private;
    readonly id: string;
    readonly rendererModel: RendererModel;
    readonly sceneObject: SceneObject;
    readonly layerId: string | null;
    readonly rendererMeshes: RendererMeshImpl[];
    constructor(params: {
        id: string;
        sceneObject: SceneObject;
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
    build2(): void;
    destroy(): void;
}
