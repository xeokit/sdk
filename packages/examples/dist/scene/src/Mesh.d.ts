import type { FloatArrayParam } from "@xeokit/math";
import type { RendererMesh } from "./RendererMesh";
import type { Geometry } from "./Geometry";
import type { TextureSet } from "./TextureSet";
import type { SceneObject } from "./SceneObject";
/**
 * A mesh in a {@link @xeokit/scene!SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link @xeokit/scene!SceneModel.createLayerMesh | SceneModel.createLayerMesh}
 * * Referenced by {@link @xeokit/scene!SceneModel.meshes | SceneObject.meshes}
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export declare class SceneMesh {
    #private;
    /**
     * Unique ID of this SceneMesh.
     *
     * SceneMesh is stored by this ID in {@link @xeokit/scene!SceneModel.meshes}.
     */
    id: string;
    /**
     * {@link @xeokit/scene!SceneGeometry} used by this SceneMesh.
     */
    geometry: Geometry;
    /**
     * {@link @xeokit/scene!SceneTextureSet} used by this SceneMesh.
     */
    textureSet?: TextureSet;
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
     * Gets the RGB color for this SceneMesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    get color(): FloatArrayParam;
    /**
     * Sets the RGB color for this SceneMesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    set color(value: FloatArrayParam);
    /**
     * Gets this SceneMesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {FloatArrayParam}
     */
    get matrix(): FloatArrayParam;
    /**
     * Updates this SceneMesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {FloatArrayParam}
     */
    set matrix(matrix: FloatArrayParam);
    /**
     * Gets this SceneMesh's metallic factor.
     *
     * This is in the range ````[0..1]```` and indicates how metallic this SceneMesh is.
     *
     * ````1```` is metal, ````0```` is non-metal.
     *
     * Default value is ````1.0````.
     */
    get metallic(): number;
    /**
     * Sets this SceneMesh's metallic factor.
     *
     * This is in the range ````[0..1]```` and indicates how metallic this SceneMesh is.
     *
     * ````1```` is metal, ````0```` is non-metal.
     *
     * Default value is ````1.0````.
     */
    set metallic(value: number);
    /**
     * Gets this SceneMesh's roughness factor.
     *
     * This factor is in the range ````[0..1]````, where ````0```` is fully smooth,````1```` is fully rough.
     *
     * Default value is ````1.0````.
     */
    get roughness(): number;
    /**
     * Sets this SceneMesh's roughness factor.
     *
     * This factor is in the range ````[0..1]````, where ````0```` is fully smooth,````1```` is fully rough.
     *
     * Default value is ````1.0````.
     */
    set roughness(value: number);
    /**
     * Gets the opacity factor for this SceneMesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    get opacity(): number;
    /**
     * Sets the opacity factor for this SceneMesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    set opacity(opacity: number);
}
