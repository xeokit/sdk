import type { FloatArrayParam } from "../math";
import type { WebGLRendererMesh } from "./WebGLRendererMesh";
import type { RendererModel, RendererObject } from "../scene";
/**
 * @private
 */
export declare class WebGLRendererObject implements RendererObject {
    #private;
    readonly id: string;
    readonly rendererModel: RendererModel;
    readonly layerId: string | null;
    readonly rendererMeshes: WebGLRendererMesh[];
    /**
     * @private
     * @param params
     */
    constructor(params: {
        id: string;
        rendererModel: RendererModel;
        rendererMeshes: WebGLRendererMesh[];
        aabb: any;
    });
    get aabb(): FloatArrayParam;
    setVisible(viewIndex: number, visible: boolean): void;
    setHighlighted(viewIndex: number, highlighted: boolean): void;
    setXRayed(viewIndex: number, xrayed: boolean): void;
    setSelected(viewIndex: number, selected: boolean): void;
    setCulled(viewIndex: number, culled: boolean): void;
    setClippable(viewIndex: number, clippable: boolean): void;
    setCollidable(viewIndex: number, collidable: boolean): void;
    setPickable(viewIndex: number, pickable: boolean): void;
    setColorize(viewIndex: number, color?: FloatArrayParam): void;
    setOpacity(viewIndex: number, opacity?: number): void;
    setOffset(viewIndex: number, offset: FloatArrayParam): void;
    initFlags(viewIndex: number): void;
    commitRendererState(viewIndex: number): void;
    destroy(): void;
}
//# sourceMappingURL=WebGLRendererObject.d.ts.map