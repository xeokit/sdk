import type {FloatArrayParam} from "@xeokit/math/math";
import type {Geometry} from "./Geometry";
import type {TextureSet} from "./TextureSet";

/**
 * Represents a mesh.
 *
 * * Stored in {@link @xeokit/core/components!SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link @xeokit/core/components!SceneModel.createMesh | SceneModel.createMesh}
 * * Referenced by {@link @xeokit/core/components!SceneObject.meshes | SceneObject.meshes}
 *
 * See usage in:
 *
 * * [@xeokit/scratchmodel](/docs/modules/_xeokit_scratchmodel.html)
 * * [@xeokit/viewer](/docs/modules/_xeokit_viewer.html)
 */
export interface Mesh {

    /**
     * Unique ID of this Mesh.
     *
     * Mesh is stored by this ID in {@link @xeokit/core/components!SceneModel.meshes}.
     */
    id: string;

    /**
     * {@link @xeokit/core/components!Geometry} used by this Mesh.
     */
    geometry: Geometry;

    /**
     * {@link TextureSet} used by this Mesh.
     */
    textureSet?: TextureSet;

    /**
     * Modeling transform for this Mesh.
     */
    matrix: FloatArrayParam;

    /**
     * RGB color for this Mesh.
     *
     * Range is [0..1, 0..1, 0.1].
     */
    color: FloatArrayParam;

    /**
     * PBR metallness factor for this Mesh.
     *
     * Range is [0..1].
     */
    metallic: number;

    /**
     * PBR roughness factor for this Mesh.
     *
     * Range is [0..1].
     */
    roughness: number;

    /**
     * Opacity factor for this Mesh.
     *
     * Range is [0..1].
     */
    opacity: number;
}
