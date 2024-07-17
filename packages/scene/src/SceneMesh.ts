import type {FloatArrayParam} from "@xeokit/math";
import {createMat4, identityMat4, isIdentityMat4} from "@xeokit/matrix";
import type {RendererMesh} from "./RendererMesh";
import type {SceneGeometry} from "./SceneGeometry";
import type {SceneTextureSet} from "./SceneTextureSet";
import type {SceneObject} from "./SceneObject";
import type {SceneMeshParams} from "./SceneMeshParams";

/**
 * A mesh in a {@link @xeokit/scene!SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link @xeokit/scene!SceneModel.createMesh | SceneModel.createMesh}
 * * Referenced by {@link @xeokit/scene!SceneModel.meshes | SceneObject.meshes}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneMesh {

    /**
     * Unique ID of this SceneMesh.
     *
     * SceneMesh is stored by this ID in {@link @xeokit/scene!SceneModel.meshes}.
     */
    id: string;

    /**
     * {@link @xeokit/scene!SceneGeometry} used by this SceneMesh.
     */
    geometry: SceneGeometry;

    /**
     * {@link @xeokit/scene!SceneTextureSet} used by this SceneMesh.
     */
    textureSet?: SceneTextureSet;

    /**
     *  Internal interface through which a {@link @xeokit/scene!SceneMesh} can load property updates into a renderers.
     *
     *  This is defined when the owner {@link @xeokit/scene!SceneModel} has been added to
     *  a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererMesh: RendererMesh | null;

    /**
     * The {@link @xeokit/scene!SceneObject} that uses this SceneMesh.
     */
    object: SceneObject | null;

    /**
     * TODO
     */
    streamLayerIndex: number;

    #color: FloatArrayParam;
    #matrix: FloatArrayParam;
    #metallic: number;
    #roughness: number;
    #opacity: number;

    readonly origin: FloatArrayParam;

    /**
     * @private
     */
    constructor(meshParams: {
        id: string;
        geometry: SceneGeometry;
        textureSet?: SceneTextureSet;
        matrix?: FloatArrayParam;
        color?: FloatArrayParam;
        opacity?: number;
        roughness?: number;
        metallic?: number;
        origin?: FloatArrayParam;
        streamLayerIndex?: number;
    }) {
        this.id = meshParams.id;
        this.#matrix = meshParams.matrix ? createMat4(meshParams.matrix) : identityMat4();
        this.geometry = meshParams.geometry;
        this.textureSet = meshParams.textureSet;
        this.rendererMesh = null;
        this.color = meshParams.color || new Float32Array([1, 1, 1]);
         this.opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? meshParams.opacity : 1.0;
        this.origin = new Float32Array(meshParams.origin !== undefined ? meshParams.origin : [0, 0, 0]);
        this.streamLayerIndex = meshParams.streamLayerIndex !== undefined ? meshParams.streamLayerIndex : 0;
    }

    /**
     * Gets the RGB color for this SceneMesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    get color(): FloatArrayParam {
        return this.#color;
    }

    /**
     * Sets the RGB color for this SceneMesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    set color(value: FloatArrayParam) {
        let color = this.#color;
        if (!color) {
            color = this.#color = new Float32Array(4);
            color[3] = 1;
        }
        if (value) {
            color[0] = value[0];
            color[1] = value[1];
            color[2] = value[2];
        } else {
            color[0] = 1;
            color[1] = 1;
            color[2] = 1;
        }
        if (this.rendererMesh) {
            this.rendererMesh.setColor(this.#color);
        }
    }

    /**
     * Gets this SceneMesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {FloatArrayParam}
     */
    get matrix(): FloatArrayParam {
        return this.#matrix;
    }

    /**
     * Updates this SceneMesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {FloatArrayParam}
     */
    set matrix(matrix: FloatArrayParam) {
        if (matrix) {
            // @ts-ignore
            this.#matrix.set(matrix);
        } else {
            identityMat4(this.#matrix);
        }
        if (this.rendererMesh) {
            this.rendererMesh.setMatrix(this.#matrix);
        }
        if (this.object) {
            this.object.setAABBDirty();
        }
    }

    /**
     * Gets the opacity factor for this SceneMesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    get opacity(): number {
        return this.#opacity;
    }

    /**
     * Sets the opacity factor for this SceneMesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    set opacity(opacity: number) {
        opacity = (opacity !== undefined && opacity !== null) ? opacity : 1.0;
        if (this.#opacity === opacity) {
            return;
        }
        this.#opacity = opacity;
        if (this.rendererMesh) {
            //       this.rendererMesh.setOpacity(this.#opacity);
        }
    }

    /**
     * Gets this SceneMesh as JSON.
     */
    getJSON(): SceneMeshParams {
        const meshParams = <SceneMeshParams>{
            streamLayerIndex: this.streamLayerIndex || 0,
            id: this.id,
            geometryId: this.geometry.id,
            color: Array.from(this.#color),
            metallic: this.#metallic,
            roughness: this.#roughness,
            opacity: this.#opacity
        };
        if (!isIdentityMat4(this.#matrix)) {
            meshParams.matrix = Array.from(this.#matrix);
        }
        if (this.origin !== undefined && (this.origin[0] !== 0 || this.origin[1] !== 0 || this.origin[2] !== 0)) {
            meshParams.origin = Array.from(this.origin);
        }
        if (this.textureSet !== undefined) {
            meshParams.textureSetId = this.textureSet.id;
        }
        return meshParams;
    }
}
