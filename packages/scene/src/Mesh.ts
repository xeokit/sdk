import {FloatArrayParam} from "@xeokit/math/math";
import {createVec3} from "@xeokit/math/matrix";
import {RendererMesh} from "./RendererMesh";
import {Geometry} from "./Geometry";
import {TextureSet} from "./TextureSet";

/**
 * Represents a mesh.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link @xeokit/scene!SceneModel.createMesh | SceneModel.createMesh}
 * * Referenced by {@link @xeokit/scene!SceneModel.meshes | SceneObject.meshes}
 *
 * See usage in [@xeokit/scene](/docs/modules/_xeokit_scene.html).
 */
export class Mesh {


    /**
     * Unique ID of this Mesh.
     *
     * Mesh is stored by this ID in {@link @xeokit/scene!SceneModel.meshes}.
     */
    id: string;

    /**
     * Optional 3D World-space origin.
     */
    origin?: FloatArrayParam;

    /**
     * {@link @xeokit/scene!Geometry} used by this Mesh.
     */
    geometry: Geometry;

    /**
     * {@link TextureSet} used by this Mesh.
     */
    textureSet?: TextureSet;

    /**
     *  Internal interface through which a {@link Mesh} can load property updates into a renderer.
     *
     *  This is defined when the owner {@link SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererMesh?: RendererMesh;

    #color: FloatArrayParam;
    #matrix: FloatArrayParam;
    #metallic: number;
    #roughness: number;
    #opacity: number;

    constructor(meshParams: {
        id: string;
        geometry: Geometry;
        textureSet: TextureSet;
        matrix: FloatArrayParam;
        color: FloatArrayParam;
        opacity: number;
        roughness: number;
        metallic: number;
    }) {
        this.id = meshParams.id;
        this.rendererMesh = null;
        this.geometry = meshParams.geometry;
        this.textureSet = meshParams.textureSet;
        this.matrix = meshParams.matrix;
        this.color = meshParams.color || createVec3([1, 1, 1]);
        this.metallic = (meshParams.metallic !== null && meshParams.metallic !== undefined) ? meshParams.metallic : 0;
        this.roughness = (meshParams.roughness !== null && meshParams.roughness !== undefined) ? meshParams.roughness : 1;
        this.opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? meshParams.opacity : 1.0;
    }

    /**
     * Gets the RGB color for this Mesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    get color(): FloatArrayParam {
        return this.#color;
    }

    /**
     * Sets the RGB color for this Mesh.
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
     * Gets this Mesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {Number[]}
     */
    get matrix(): FloatArrayParam {
        // if (this._localMatrixDirty) {
        //     if (!this.__localMatrix) {
        //         this.__localMatrix = math.identityMat4();
        //     }
        //     math.composeMat4(this._position, this._quaternion, this._scale, this.__localMatrix);
        //     this._localMatrixDirty = false;
        // }
        // return this.__localMatrix;
        return [];
    }

    /**
     * Updates this Mesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {Number[]}
     */
    set matrix(matrix: FloatArrayParam) {

    }

    /**
     * Sets this Mesh's metallic factor.
     *
     * This is in the range ````[0..1]```` and indicates how metallic this Mesh is.
     *
     * ````1```` is metal, ````0```` is non-metal.
     *
     * Default value is ````1.0````.
     */
    set metallic(value: number) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this.#metallic === value) {
            return;
        }
        this.#metallic = value;
        if (this.rendererMesh) {
            this.rendererMesh.setMetallic(this.#metallic);
        }
    }

    /**
     * Gets this Mesh's metallic factor.
     *
     * This is in the range ````[0..1]```` and indicates how metallic this Mesh is.
     *
     * ````1```` is metal, ````0```` is non-metal.
     *
     * Default value is ````1.0````.
     */
    get metallic(): number {
        return this.#metallic;
    }

    /**
     * Sets this Mesh's roughness factor.
     *
     * This factor is in the range ````[0..1]````, where ````0```` is fully smooth,````1```` is fully rough.
     *
     * Default value is ````1.0````.
     */
    set roughness(value: number) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this.#roughness === value) {
            return;
        }
        this.#roughness = value;
        if (this.rendererMesh) {
            this.rendererMesh.setRoughness(this.#roughness);
        }
    }

    /**
     * Gets this Mesh's roughness factor.
     *
     * This factor is in the range ````[0..1]````, where ````0```` is fully smooth,````1```` is fully rough.
     *
     * Default value is ````1.0````.
     */
    get roughness(): number {
        return this.#roughness;
    }

    /**
     * Sets the opacity factor for this Mesh.
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
     * Gets the opacity factor for this Mesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    get opacity(): number {
        return this.#opacity;
    }
}
