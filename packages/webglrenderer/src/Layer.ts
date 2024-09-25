
import {WebGLRendererModel} from "./WebGLRendererModel";
import {MeshCounts} from "./MeshCounts";
import {SceneGeometry, SceneMesh} from "@xeokit/scene";
import {FloatArrayParam} from "@xeokit/math";
import {LayerMeshParams} from "./LayerMeshParams";
import {RenderContext} from "./RenderContext";

/**
 * @private
 */
export interface Layer {

    renderContext: RenderContext;
    primitive: number;
    rendererModel: WebGLRendererModel;
    layerIndex: number;
    sortId: string;
    meshCounts: MeshCounts[];
    saoSupported: boolean;

    //---------------------------------------------------------
    // Builder methods
    //---------------------------------------------------------

    canCreateLayerMesh(sceneGeometry: SceneGeometry): boolean;

    createLayerMesh(layerMeshParams: LayerMeshParams, sceneMesh: SceneMesh): number; // Returns layerMeshIndex

    build(): void;

    isEmpty(): boolean;

    //---------------------------------------------------------
    // State update methods
    //---------------------------------------------------------

    setLayerMeshFlags(viewIndex: number, layerMeshIndex: number, flags: number, meshTransparent: boolean): void;

    setLayerMeshVisible(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshHighlighted(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshXRayed(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshSelected(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshClippable(viewIndex: number, layerMeshIndex: number, flags: number): void;

    setLayerMeshCulled(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshCollidable(viewIndex: number, layerMeshIndex, flags): void;

    setLayerMeshPickable(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshColor(viewIndex: number, layerMeshIndex: number, color: FloatArrayParam, setOpacity: boolean): void;

    setLayerMeshTransparent(viewIndex: number, layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshOffset(viewIndex: number, layerMeshIndex: number, offset: FloatArrayParam): void;

    setLayerMeshMatrix( layerMeshIndex: number, matrix: FloatArrayParam): void;

    commitRendererState(viewIndex: number): void;

    //---------------------------------------------------------
    // Drawing methods
    //---------------------------------------------------------

    drawColorOpaque() : void;

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

    initFlags(viewIndex: number, meshIndex: number, flags: number, transparent): void;
}
