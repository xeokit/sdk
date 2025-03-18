import { Layer } from "../../Layer";
import { WebGLRendererModel } from "../../WebGLRendererModel";
import { MeshCounts } from "../../MeshCounts";
import { FloatArrayParam } from "../../../math";
import { LayerMeshParams } from "../../LayerMeshParams";
import { SceneGeometry, SceneMesh } from "../../../scene";
import { VBOBatchingRenderState } from "./VBOBatchingRenderState";
import { RenderContext } from "../../RenderContext";
import { VBOBatchingLayerParams } from "./VBOBatchingLayerParams";
import { VBORendererSet } from "../VBORendererSet";
/**
 * @private
 */
export declare class VBOBatchingLayer implements Layer {
    #private;
    primitive: number;
    rendererModel: WebGLRendererModel;
    layerIndex: number;
    meshCounts: MeshCounts[];
    renderState: VBOBatchingRenderState;
    sortId: string;
    saoSupported: boolean;
    aabbDirty: boolean;
    renderContext: RenderContext;
    constructor(vBOBatchingLayerParams: VBOBatchingLayerParams, rendererSet: VBORendererSet);
    get hash(): string;
    get aabb(): FloatArrayParam;
    canCreateLayerMesh(sceneGeometry: SceneGeometry): boolean;
    createLayerMesh(layerMeshParams: LayerMeshParams, sceneMesh: SceneMesh): number;
    /**
     * Builds batch VBOs from appended geometries.
     * No more portions can then be created.
     */
    build(): void;
    initFlags(viewIndex: number, layerMeshIndex: number, flags: number, meshTransparent: boolean): void;
    setLayerMeshVisible(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;
    setLayerMeshHighlighted(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;
    setLayerMeshXRayed(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;
    setLayerMeshSelected(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;
    setLayerMeshClippable(viewIndex: number, layerMeshIndex: number, flags: number): void;
    setLayerMeshCulled(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;
    setLayerMeshCollidable(viewIndex: number, layerMeshIndex: number, flags: number): void;
    setLayerMeshPickable(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;
    setLayerMeshColor(viewIndex: number, layerMeshIndex: number, color: FloatArrayParam): void;
    setLayerMeshTransparent(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;
    setLayerMeshFlags(viewIndex: number, layerMeshIndex: number, flags: number, transparent?: boolean): void;
    setLayerMeshMatrix(layerMeshIndex: number, matrix: FloatArrayParam): void;
    setLayerMeshOffset(viewIndex: number, layerMeshIndex: number, offset: FloatArrayParam): void;
    drawColorOpaque(): void;
    drawColorSAOOpaque(): void;
    drawColorTranslucent(): void;
    drawDepth(): void;
    drawNormals(): void;
    drawSilhouetteXRayed(): void;
    drawSilhouetteHighlighted(): void;
    drawSilhouetteSelected(): void;
    drawEdgesColorOpaque(): void;
    drawEdgesColorTranslucent(): void;
    drawEdgesHighlighted(): void;
    drawEdgesSelected(): void;
    drawEdgesXRayed(): void;
    drawOcclusion(): void;
    drawShadow(): void;
    drawPickMesh(): void;
    drawPickDepths(): void;
    drawSnapInit(): void;
    drawSnap(): void;
    drawPickNormals(): void;
    destroy(): void;
    commitRendererState(viewIndex: number): void;
    isEmpty(): boolean;
}
//# sourceMappingURL=VBOBatchingLayer.d.ts.map