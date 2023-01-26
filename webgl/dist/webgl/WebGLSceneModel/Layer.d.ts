import type { WebGLViewerModel } from "./WebGLViewerModel";
import { DataTextureSet } from "./DataTextureSet";
import { GeometryCompressedParams, math, MeshParams, RTCViewMat, View } from "../../viewer/index";
import type { TextureSet } from "./TextureSet";
import { MeshCounts } from "./MeshCounts";
export interface LayerParams {
    gl: WebGL2RenderingContext;
    view: View;
    viewerModel: WebGLViewerModel;
    primitive: number;
    origin: math.FloatArrayParam;
    layerIndex: number;
    textureSet?: TextureSet;
}
export interface LayerRenderState {
    materialTextureSet: TextureSet;
    dataTextureSet: DataTextureSet;
    primitive: number;
    origin: math.FloatArrayParam;
    numIndices8Bits: number;
    numIndices16Bits: number;
    numIndices32Bits: number;
    numEdgeIndices8Bits: number;
    numEdgeIndices16Bits: number;
    numEdgeIndices32Bits: number;
    numVertices: number;
}
export declare class Layer {
    #private;
    viewerModel: WebGLViewerModel;
    layerIndex: number;
    rtcViewMat: RTCViewMat;
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
    initFlags(meshId: number, flags: number, meshTransparent: boolean): void;
    beginDeferredFlags(): void;
    commitDeferredFlags(): void;
    flushInitFlags(): void;
    setMeshVisible(meshId: number, flags: number, transparent: boolean): void;
    setMeshHighlighted(meshId: number, flags: number, transparent: boolean): void;
    setMeshXRayed(meshId: number, flags: number, transparent: boolean): void;
    setMeshSelected(meshId: number, flags: number, transparent: boolean): void;
    setMeshEdges(meshId: number, flags: number, transparent: boolean): void;
    setMeshClippable(meshId: number, flags: number): void;
    setMeshCulled(meshId: number, flags: number, transparent: boolean): void;
    setMeshCollidable(meshId: number, flags: number): void;
    setMeshPickable(meshId: number, flags: number, transparent: boolean): void;
    setMeshColor(meshId: number, color: math.FloatArrayParam, transparent?: boolean): void;
    setMeshTransparent(meshId: number, flags: number, transparent: boolean): void;
    setMeshOffset(meshId: number, offset: math.FloatArrayParam): void;
    destroy(): void;
}
