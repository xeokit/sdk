import type { FloatArrayParam } from "@xeokit/math";
import type { RendererMesh } from "./RendererMesh";
import type { Geometry } from "./Geometry";
import type { TextureSet } from "./TextureSet";
import type { SceneObject } from "./SceneObject";
/**
 * A mesh in a {@link SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link @xeokit/scene!SceneModel.createMesh | SceneModel.createMesh}
 * * Referenced by {@link @xeokit/scene!SceneModel.meshes | SceneObject.meshes}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export declare class Mesh {
    #private;
    /**
     * Unique ID of this Mesh.
     *
     * Mesh is stored by this ID in {@link @xeokit/scene!SceneModel.meshes}.
     */
    id: string;
    /**
     * {@link @xeokit/scene!Geometry} used by this Mesh.
     */
    geometry: Geometry;
    /**
     * {@link @xeokit/scene!TextureSet} used by this Mesh.
     */
    textureSet?: TextureSet;
    /**
     *  Internal interface through which a {@link Mesh} can load property updates into a renderer.
     *
     *  This is defined when the owner {@link @xeokit/scene!SceneModel} has been added to
     *  a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererMesh: RendererMesh | null;
    /**
     * The {@link @xeokit/scene!SceneObject} that uses this Mesh.
     */
    object: SceneObject | null;
    /**
     * @private
     */
    constructor(meshParams: {
        id: string;
        geometry: Geometry;
        textureSet?: TextureSet;
        matrix?: FloatArrayParam;
        color?: FloatArrayParam;
        opacity?: number;
        roughness?: number;
        metallic?: number;
    });
    /**
     * Gets the RGB color for this Mesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    get color(): FloatArrayParam;
    /**
     * Sets the RGB color for this Mesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    set color(value: FloatArrayParam);
    /**
     * Gets this Mesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {FloatArrayParam}
     */
    get matrix(): FloatArrayParam;
    /**
     * Updates this Mesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {FloatArrayParam}
     */
    set matrix(matrix: FloatArrayParam);
    /**
     * Gets this Mesh's metallic factor.
     *
     * This is in the range ````[0..1]```` and indicates how metallic this Mesh is.
     *
     * ````1```` is metal, ````0```` is non-metal.
     *
     * Default value is ````1.0````.
     */
    get metallic(): number;
    /**
     * Sets this Mesh's metallic factor.
     *
     * This is in the range ````[0..1]```` and indicates how metallic this Mesh is.
     *
     * ````1```` is metal, ````0```` is non-metal.
     *
     * Default value is ````1.0````.
     */
    set metallic(value: number);
    /**
     * Gets this Mesh's roughness factor.
     *
     * This factor is in the range ````[0..1]````, where ````0```` is fully smooth,````1```` is fully rough.
     *
     * Default value is ````1.0````.
     */
    get roughness(): number;
    /**
     * Sets this Mesh's roughness factor.
     *
     * This factor is in the range ````[0..1]````, where ````0```` is fully smooth,````1```` is fully rough.
     *
     * Default value is ````1.0````.
     */
    set roughness(value: number);
    /**
     * Gets the opacity factor for this Mesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    get opacity(): number;
    /**
     * Sets the opacity factor for this Mesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    set opacity(opacity: number);
}
