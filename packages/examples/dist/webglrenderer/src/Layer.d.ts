import type { FloatArrayParam } from "@xeokit/math";
import type { WebGLRendererModel } from "./WebGLRendererModel";
import { DataTextureSet } from "./DataTextureSet";
import { MeshCounts } from "./MeshCounts";
import type { GeometryCompressedParams, MeshParams } from "@xeokit/scene";
import type { WebGLRendererTextureSet } from "./WebGLRendererTextureSet";
import type { LayerParams } from "./LayerParams";
/**
 * @private
 */
export interface LayerRenderState {
    materialTextureSet: WebGLRendererTextureSet;
    dataTextureSet: DataTextureSet;
    primitive: number;
    numIndices8Bits: number;
    numIndices16Bits: number;
    numIndices32Bits: number;
    numEdgeIndices8Bits: number;
    numEdgeIndices16Bits: number;
    numEdgeIndices32Bits: number;
    numVertices: number;
}
/**
 * @private
 */
export declare class Layer {
    #private;
    rendererSceneModel: WebGLRendererModel;
    layerIndex: number;
    meshCounts: MeshCounts;
    renderState: LayerRenderState;
    constructor(layerParams: LayerParams, renderers?: any);
    get hash(): string;
    canCreateMesh(geometryCompressedParams: GeometryCompressedParams): boolean;
    hasGeometry(geometryId: string): boolean;
    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): void;
    createMesh(meshParams: MeshParams): number;
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
