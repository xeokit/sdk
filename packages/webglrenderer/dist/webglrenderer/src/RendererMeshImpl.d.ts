import type { RendererGeometry, RendererMesh, RendererObject, RendererTextureSet, SceneObject } from "@xeokit/scene";
import type { FloatArrayParam } from "@xeokit/math";
import type { RenderContext } from "./RenderContext";
import type { Layer } from "./Layer";
import type { Pickable } from "./Pickable";
import type { Tile, TileManager } from "./TileManager";
/**
 * @private
 */
export declare class RendererMeshImpl implements RendererMesh, Pickable {
    id: string;
    color: FloatArrayParam;
    rendererGeometry: RendererGeometry;
    rendererTextureSet: RendererTextureSet;
    matrix: FloatArrayParam;
    metallic: number;
    roughness: number;
    opacity: number;
    pickId: number;
    tileManager: TileManager;
    tile: Tile;
    sceneObjectRenderer: RendererObject | null;
    aabb: FloatArrayParam;
    layer: Layer;
    meshIndex: number;
    colorize: FloatArrayParam;
    colorizing: boolean;
    transparent: boolean;
    constructor(params: {
        tileManager: TileManager;
        layer: Layer;
        id: string;
        matrix: FloatArrayParam;
        metallic: number;
        roughness: number;
        color: FloatArrayParam;
        opacity: number;
        rendererTextureSet: RendererTextureSet;
        rendererGeometry: RendererGeometry;
        meshIndex: number;
    });
    delegatePickedEntity(): SceneObject;
    setSceneObject(sceneObjectRenderer: RendererObject): void;
    build(flags: number): void;
    finalize2(): void;
    setVisible(flags: any): void;
    setMatrix(matrix: FloatArrayParam): void;
    setMetallic(metallic: number): void;
    setRoughness(roughness: number): void;
    setColor(color: FloatArrayParam): void;
    setColorize(colorize: FloatArrayParam | null): void;
    setOpacity(opacity: number, flags: number): void;
    setHighlighted(flags: number): void;
    setXRayed(flags: number): void;
    setSelected(flags: number): void;
    setEdges(flags: number): void;
    setClippable(flags: number): void;
    setCollidable(flags: number): void;
    setPickable(flags: number): void;
    setCulled(flags: number): void;
    canPickTriangle(): boolean;
    drawPickTriangles(drawFlags: any, renderContext: any): void;
    pickTriangleSurface(pickResult: any): void;
    canPickWorldPos(): boolean;
    drawPickNormals(renderContext: RenderContext): void;
    destroy(): void;
}
