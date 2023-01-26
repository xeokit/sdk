import { Component, Scene, View, ViewerModel, math, GeometryParams, MeshParams, SceneObjectParams, TextureParams, TextureSetParams, ViewerObject, Transform, GeometryCompressedParams, EventEmitter } from "../../viewer/index";
import type { WebGLRenderer } from "../WebGLRenderer";
import { Layer } from "./Layer";
import { WebGLSceneObject } from "./WebGLSceneObject";
import type { TransformParams } from "../../viewer/scene/TransformParams";
import type { TextureTranscoder } from "../../viewer/textureTranscoders/TextureTranscoder";
import type { RenderContext } from "../RenderContext";
export declare class WebGLViewerModel extends Component implements ViewerModel {
    #private;
    readonly qualityRender: boolean;
    readonly id: string;
    readonly scene: Scene;
    readonly destroyed: boolean;
    objects: {
        [key: string]: WebGLSceneObject;
    };
    objectList: WebGLSceneObject[];
    layerList: Layer[];
    /**
     * Emits an event when the {@link ViewerModel} has been built.
     *
     * @event
     */
    readonly onBuilt: EventEmitter<ViewerModel, null>;
    constructor(params: {
        id: string;
        matrix?: math.FloatArrayParam;
        scale?: math.FloatArrayParam;
        view: View;
        scene: Scene;
        webglRenderer: WebGLRenderer;
        renderContext: RenderContext;
        quaternion?: math.FloatArrayParam;
        rotation?: math.FloatArrayParam;
        position?: math.FloatArrayParam;
        origin?: math.FloatArrayParam;
        edgeThreshold?: number;
        textureTranscoder: TextureTranscoder;
        qualityRender?: boolean;
        viewLayerId?: string;
    });
    get origin(): math.FloatArrayParam;
    get position(): math.FloatArrayParam;
    get rotation(): math.FloatArrayParam;
    get quaternion(): math.FloatArrayParam;
    get scale(): math.FloatArrayParam;
    get worldMatrix(): math.FloatArrayParam;
    get viewMatrix(): math.FloatArrayParam;
    get colorTextureEnabled(): boolean;
    get backfaces(): boolean;
    set backfaces(backfaces: boolean);
    get matrix(): math.FloatArrayParam;
    get aabb(): math.FloatArrayParam;
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
    setColorize(viewIndex: number, colorize: math.FloatArrayParam): void;
    setOpacity(viewIndex: number, opacity: number): void;
    createTransform(transformParams: TransformParams): Transform | null;
    createGeometry(geometryParams: GeometryParams): void;
    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams): void;
    createTexture(textureParams: TextureParams): void;
    createTextureSet(textureSetParams: TextureSetParams): void;
    createMesh(meshParams: MeshParams): void;
    createObject(sceneObjectParams: SceneObjectParams): ViewerObject;
    build(): void;
    destroy(): void;
}
