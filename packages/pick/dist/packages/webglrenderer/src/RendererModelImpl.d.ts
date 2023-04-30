import { Component, EventEmitter, TextureTranscoder } from "@xeokit/core";
import type { FloatArrayParam } from "@xeokit/math";
import type { View } from "@xeokit/viewer";
import type { Viewer } from "@xeokit/viewer";
import type { RendererGeometry, RendererMesh, RendererModel, RendererTexture, RendererTextureSet, SceneModel } from "@xeokit/scene";
import type { WebGLRenderer } from "./WebGLRenderer";
import { Layer } from "./Layer";
import type { RenderContext } from "./RenderContext";
import type { RendererViewObject } from "viewer/src/RendererViewObject";
import { RendererObjectImpl } from "./RendererObjectImpl";
/**
 * @private
 */
export declare class RendererModelImpl extends Component implements RendererModel {
    #private;
    readonly qualityRender: boolean;
    readonly id: string;
    readonly destroyed: boolean;
    built: boolean;
    sceneModel: SceneModel | null;
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
        [key: string]: RendererMesh;
    };
    rendererObjects: {
        [key: string]: RendererObjectImpl;
    };
    rendererObjectsList: RendererObjectImpl[];
    rendererViewObjects: {
        [key: string]: RendererViewObject;
    };
    readonly viewer: Viewer;
    layerList: Layer[];
    readonly onBuilt: EventEmitter<RendererModel, null>;
    readonly onDestroyed: EventEmitter<Component, null>;
    constructor(params: {
        id: string;
        sceneModel: SceneModel;
        matrix?: FloatArrayParam;
        scale?: FloatArrayParam;
        view: View;
        webglRenderer: WebGLRenderer;
        renderContext: RenderContext;
        quaternion?: FloatArrayParam;
        rotation?: FloatArrayParam;
        position?: FloatArrayParam;
        edgeThreshold?: number;
        textureTranscoder: TextureTranscoder;
        qualityRender?: boolean;
        layerId?: string;
    });
    get position(): FloatArrayParam;
    get rotation(): FloatArrayParam;
    get quaternion(): FloatArrayParam;
    get scale(): FloatArrayParam;
    get worldMatrix(): FloatArrayParam;
    get viewMatrix(): FloatArrayParam;
    get colorTextureEnabled(): boolean;
    get backfaces(): boolean;
    set backfaces(backfaces: boolean);
    get matrix(): FloatArrayParam;
    get aabb(): FloatArrayParam;
    get numTriangles(): number;
    get numLines(): number;
    get numPoints(): number;
    setVisible(viewIndex: number, visible: boolean): void;
    setXRayed(viewIndex: number, xrayed: boolean): void;
    setHighlighted(viewIndex: number, highlighted: boolean): void;
    setSelected(viewIndex: number, selected: boolean): void;
    setEdges(viewIndex: number, edges: boolean): void;
    setCulled(viewIndex: number, culled: boolean): void;
    setClippable(viewIndex: number, clippable: boolean): void;
    setCollidable(viewIndex: number, collidable: boolean): void;
    setPickable(viewIndex: number, pickable: boolean): void;
    setColorize(viewIndex: number, colorize: FloatArrayParam): void;
    setOpacity(viewIndex: number, opacity: number): void;
    destroy(): void;
}
