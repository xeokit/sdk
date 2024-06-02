import {View} from "@xeokit/viewer";
import {WebGLRendererModel} from "./WebGLRendererModel";
import {MeshCounts} from "./MeshCounts";
import {SceneGeometry, SceneMesh} from "@xeokit/scene";
import {FloatArrayParam} from "@xeokit/math";
import {LayerMeshParams} from "./LayerMeshParams";

/**
 * @private
 */
export interface Layer {

    gl: WebGL2RenderingContext;
    primitive: number;
    view: View;
    rendererModel: WebGLRendererModel;
    layerIndex: number;
    sortId: string;
    meshCounts: MeshCounts;

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

    setLayerMeshFlags(layerMeshIndex: number, flags: number, meshTransparent: boolean): void;

    setLayerMeshVisible(layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshHighlighted(layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshXRayed(layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshSelected(layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshEdges(layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshClippable(layerMeshIndex: number, flags: number): void;

    setLayerMeshCulled(layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshCollidable(layerMeshIndex, flags): void;

    setLayerMeshPickable(layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshColor(layerMeshIndex: number, color: FloatArrayParam, setOpacity: boolean): void;

    setLayerMeshTransparent(layerMeshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshOffset(layerMeshIndex: number, offset: FloatArrayParam): void;

    setLayerMeshMatrix(layerMeshIndex: number, matrix: FloatArrayParam): void;

    commitRendererState(): void;

    //---------------------------------------------------------
    // Drawing methods
    //---------------------------------------------------------

    drawColorOpaque() : void;

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
}
