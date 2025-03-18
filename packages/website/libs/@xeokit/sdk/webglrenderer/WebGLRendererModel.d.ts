import { Component, EventEmitter, type TextureTranscoder } from "../core";
import type { FloatArrayParam } from "../math";
import type { Viewer } from "../viewer";
import type { RendererGeometry, RendererModel, RendererTexture, RendererTextureSet, SceneModel } from "../scene";
import type { WebGLRenderer } from "./WebGLRenderer";
import type { RenderContext } from "./RenderContext";
import { WebGLRendererObject } from "./WebGLRendererObject";
import { WebGLRendererMesh } from "./WebGLRendererMesh";
import { MeshCounts } from "./MeshCounts";
import { RenderFlags } from "./RenderFlags";
import { Layer } from "./Layer";
/**
 * @private
 */
export declare class WebGLRendererModel extends Component implements RendererModel {
    #private;
    readonly id: string;
    readonly viewer: Viewer;
    readonly qualityRender: boolean;
    readonly destroyed: boolean;
    rendererGeometries: {
        [key: string]: RendererGeometry;
    };
    rendererTextures: {
        [key: string]: RendererTexture;
    };
    rendererTextureSets: {
        [key: string]: RendererTextureSet;
    };
    rendererMeshes: {
        [key: string]: WebGLRendererMesh;
    };
    rendererObjects: {
        [key: string]: WebGLRendererObject;
    };
    rendererObjectsList: WebGLRendererObject[];
    layerList: Layer[];
    meshCounts: MeshCounts[];
    readonly onDestroyed: EventEmitter<Component, null>;
    webglRenderer: WebGLRenderer;
    numSubMeshes: number;
    renderFlags: RenderFlags[];
    constructor(params: {
        id: string;
        viewer: Viewer;
        sceneModel: SceneModel;
        matrix?: FloatArrayParam;
        scale?: FloatArrayParam;
        webglRenderer: WebGLRenderer;
        renderContext: RenderContext;
        quaternion?: FloatArrayParam;
        rotation?: FloatArrayParam;
        position?: FloatArrayParam;
        edgeThreshold?: number;
        textureTranscoder: TextureTranscoder;
        qualityRender?: boolean;
    });
    get position(): FloatArrayParam;
    get rotation(): FloatArrayParam;
    get quaternion(): FloatArrayParam;
    get scale(): FloatArrayParam;
    get worldMatrix(): FloatArrayParam;
    get colorTextureEnabled(): boolean;
    get backfaces(): boolean;
    set backfaces(backfaces: boolean);
    get matrix(): FloatArrayParam;
    get aabb(): FloatArrayParam;
    get numTriangles(): number;
    get numLines(): number;
    get numPoints(): number;
    /** @private */
    rebuildRenderFlags(viewIndex: number): void;
    destroy(): void;
}
//# sourceMappingURL=WebGLRendererModel.d.ts.map