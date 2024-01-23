import type {FloatArrayParam} from "@xeokit/math";
import {MeshCounts} from "./MeshCounts";
import type {SceneGeometryCompressedParams} from "@xeokit/scene";
import {SceneMesh} from "@xeokit/scene";
import type {LayerParams} from "./LayerParams";
import {LayerMeshParams} from "./LayerMeshParams";
import {RenderContext} from "./RenderContext";
import {RendererSet} from "./RendererSet";

/**
 * @private
 */
export declare class Layer {
    layerIndex: number;
    meshCounts: MeshCounts;
    sortId: string;

    constructor(layerParams: LayerParams, renderers?: any);

    get hash(): string;

    canCreateLayerMesh(geometryCompressedParams: SceneGeometryCompressedParams): boolean;

    createLayerMesh(layerMeshParams: LayerMeshParams, mesh: SceneMesh): number;

    build(): void;

    isEmpty(): boolean;

    setLayerMeshFlags(meshIndex: number, flags: number, meshTransparent: boolean): void;

    commitLayerMeshFlags(): void;

    setLayerMeshVisible(meshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshHighlighted(meshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshXRayed(meshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshSelected(meshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshEdges(meshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshClippable(meshIndex: number, flags: number): void;

    setLayerMeshCulled(meshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshCollidable(meshIndex: number, flags: number): void;

    setLayerMeshPickable(meshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshColor(meshIndex: number, color: FloatArrayParam, transparent?: boolean): void;

    setLayerMeshTransparent(meshIndex: number, flags: number, transparent: boolean): void;

    setLayerMeshOffset(meshIndex: number, offset: FloatArrayParam): void;

    setLayerMeshMatrix(meshIndex: number, matrix: FloatArrayParam): void;

    //setLayerMeshViewMatrix(meshIndex: number, index: number): void;

    draw(renderContext: RenderContext, rendererSet: RendererSet): void;

    destroy(): void;
}
