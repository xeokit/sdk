import type { FloatArrayParam } from "@xeokit/math";
import type { RendererModelImpl } from "./RendererModelImpl";
import { MeshCounts } from "./MeshCounts";
import type { SceneGeometryCompressedParams, SceneMeshParams } from "@xeokit/scene";
import type { LayerParams } from "./LayerParams";

/**
 * @private
 */
export declare class Layer {
    #private;
    rendererModel: RendererModelImpl;
    layerIndex: number;
    meshCounts: MeshCounts;
    constructor(layerParams: LayerParams, renderers?: any);
    get hash(): string;
    canCreateMesh(geometryCompressedParams: SceneGeometryCompressedParams): boolean;
    hasGeometry(geometryId: string): boolean;
    createGeometryCompressed(geometryCompressedParams: SceneGeometryCompressedParams): void;
    createMesh(meshParams: SceneMeshParams): number;
    build(): void;
    isEmpty(): boolean;
    initFlags(meshIndex: number, flags: number, meshTransparent: boolean): void;
    beginDeferredFlags(): void;
    commitDeferredFlags(): void;
    flushInitFlags(): void;
    setMeshVisible(meshIndex: number, flags: number, transparent: boolean): void;
    setMeshHighlighted(meshIndex: number, flags: number, transparent: boolean): void;
    setMeshXRayed(meshIndex: number, flags: number, transparent: boolean): void;
    setMeshSelected(meshIndex: number, flags: number, transparent: boolean): void;
    setMeshEdges(meshIndex: number, flags: number, transparent: boolean): void;
    setMeshClippable(meshIndex: number, flags: number): void;
    setMeshCulled(meshIndex: number, flags: number, transparent: boolean): void;
    setMeshCollidable(meshIndex: number, flags: number): void;
    setMeshPickable(meshIndex: number, flags: number, transparent: boolean): void;
    setMeshColor(meshIndex: number, color: FloatArrayParam, transparent?: boolean): void;
    setMeshTransparent(meshIndex: number, flags: number, transparent: boolean): void;
    setMeshOffset(meshIndex: number, offset: FloatArrayParam): void;
    setMeshMatrix(meshIndex: number, matrix: FloatArrayParam): void;
    setMeshViewMatrixIndex(meshIndex: number, index: number): void;
    destroy(): void;
}
