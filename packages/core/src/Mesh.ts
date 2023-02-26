import type {FloatArrayParam} from "@xeokit/math/math";
import type {Geometry} from "./Geometry";
import type {TextureSet} from "./TextureSet";
import type {RendererMesh} from "./RendererMesh";

/**
 * Represents a mesh.
 *
 * * Stored in {@link @xeokit/core/components!SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link @xeokit/core/components!SceneModel.createMesh | SceneModel.createMesh}
 * * Referenced by {@link @xeokit/core/components!SceneObject.meshes | SceneObject.meshes}
 *
 * See usage in [@xeokit/scratchmodel](/docs/modules/_xeokit_scratchmodel.html).
 */
export interface Mesh {

    /**
     * Unique ID of this Mesh.
     *
     * Mesh is stored by this ID in {@link @xeokit/core/components!SceneModel.meshes}.
     */
    id: string;

    /**
     * Optional 3D World-space origin.
     */
    origin?: FloatArrayParam;

    /**
     * {@link @xeokit/core/components!Geometry} used by this Mesh.
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

    /**
     * Updates the modeling transform for this Mesh.
     */
    set matrix(matrix: FloatArrayParam);

    /**
     * Gets the modeling transform for this Mesh.
     */
    get matrix(): FloatArrayParam;

    /**
     * Updates the RGB base color of this Mesh.
     *
     * Range is [0..1, 0..1, 0.1].
     */
    set color(color: FloatArrayParam);

    /**
     * Gets the RGB base color of this Mesh.
     *
     * Range is [0..1, 0..1, 0.1].
     */
    get color():FloatArrayParam;

    /**
     * Updates the PBR metallness factor for this Mesh.
     *
     * Range is [0..1].
     */
    set metallic(metallic: number);

    /**
     * Gets the PBR metallness factor for this Mesh.
     *
     * Range is [0..1].
     */
    get metallic(): number;

    /**
     * Updates the PBR roughness factor for this Mesh.
     *
     * Range is [0..1].
     */
    set roughness(roughness: number);

    /**
     * Gets the PBR roughness factor for this Mesh.
     *
     * Range is [0..1].
     */
    get roughness(): number;

    /**
     * Updates the opacity factor for this Mesh.
     *
     * Range is [0..1].
     */
    set opacity(opacity: number);

    /**
     * Gets the opacity factor for this Mesh.
     *
     * Range is [0..1].
     */
    get opacity(): number;
}

