import type { RendererGeometry, RendererMesh, RendererObject, RendererTextureSet, SceneObject } from "../scene";
import type { FloatArrayParam } from "../math";
import type { RenderContext } from "./RenderContext";
import type { Pickable } from "./Pickable";
import type { Tile, WebGLTileManager } from "./WebGLTileManager";
import { Layer } from "./Layer";
/**
 * @private
 */
export declare class WebGLRendererMesh implements RendererMesh, Pickable {
    id: string;
    color: FloatArrayParam;
    rendererGeometry: RendererGeometry;
    rendererTextureSet: RendererTextureSet;
    matrix: FloatArrayParam;
    opacity: number;
    pickId: number;
    tileManager: WebGLTileManager;
    tile: Tile;
    rendererObject: RendererObject | null;
    aabb: FloatArrayParam;
    layer: Layer;
    meshIndex: number;
    colorize: FloatArrayParam[];
    colorizing: boolean[];
    transparent: boolean[];
    attribs: any;
    constructor(params: {
        tileManager: WebGLTileManager;
        layer: Layer;
        id: string;
        matrix: FloatArrayParam;
        color: FloatArrayParam;
        opacity: number;
        rendererTextureSet: RendererTextureSet;
        rendererGeometry: RendererGeometry;
        meshIndex: number;
    });
    delegatePickedEntity(): SceneObject;
    setRendererObject(rendererObject: RendererObject): void;
    setVisible(viewIndex: number, flags: any): void;
    setMatrix(matrix: FloatArrayParam): void;
    setColor(color: FloatArrayParam): void;
    setColorize(viewIndex: number, colorize: FloatArrayParam | null): void;
    setOpacity(viewIndex: number, opacity: number, flags: number): void;
    setHighlighted(viewIndex: number, flags: number): void;
    setXRayed(viewIndex: number, flags: number): void;
    setSelected(viewIndex: number, flags: number): void;
    setClippable(viewIndex: number, flags: number): void;
    setCollidable(viewIndex: number, flags: number): void;
    setPickable(viewIndex: number, flags: number): void;
    setCulled(viewIndex: number, flags: number): void;
    canPickTriangle(): boolean;
    drawPickTriangles(drawFlags: any, renderContext: any): void;
    pickTriangleSurface(pickResult: any): void;
    canPickWorldPos(): boolean;
    drawPickNormals(renderContext: RenderContext): void;
    initFlags(viewIndex: number, flags: number): void;
    commitRendererState(viewIndex: number): void;
    destroy(): void;
}
//# sourceMappingURL=RendererMesh.d.ts.map
