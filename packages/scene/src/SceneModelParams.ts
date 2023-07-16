import type {FloatArrayParam} from "@xeokit/math";

import type {GeometryCompressedParams} from "./GeometryCompressedParams";
import type {TextureParams} from "./TextureParams";
import type {TextureSetParams} from "./TextureSetParams";
import type {SceneObject} from "./SceneObject";
import type {MeshParams} from "./MeshParams";
import type {GeometryParams} from "./GeometryParams";
import type {SceneObjectParams} from "./SceneObjectParams";


/**
 * {@link @xeokit/scene!SceneModel | SceneModel} creation parameters for {@link @xeokit/scene!Scene.createModel | Scene.createModel}.
 *
 * See {@link "@xeokit/scene"} for usage.
 */
export interface SceneModelParams {

    /**
     * Unique ID for the SceneModel.
     *
     * The SceneModel is stored with this ID in {@link @xeokit/scene!Scene.models | Scene.models}
     */
    id: string;

    /**
     * 4x4 transform matrix.
     */
    matrix?: FloatArrayParam;

    /**
     * Scale of the SceneModel.
     *
     * Default is ````[1,1,1]````.
     */
    scale?: FloatArrayParam;

    /**
     * Quaternion defining the orientation of the SceneModel.
     */
    quaternion?: FloatArrayParam;

    /**
     * Orientation of the SceneModel, given as Euler angles in degrees for X, Y and Z axis.
     */
    rotation?: FloatArrayParam;

    /**
     * World-space position of the SceneModel.
     */
    position?: FloatArrayParam;

    /**
     * {@link @xeokit/scene!GeometryParams} in the SceneModel.
     */
    geometries?: GeometryParams[];

    /**
     * {@link @xeokit/scene!GeometryCompressedParams} in the SceneModel.
     */
    geometriesCompressed?: GeometryCompressedParams[];

    /**
     * {@link @xeokit/scene!Texture | Textures} in the SceneModel.
     */
    textures?: TextureParams[];

    /**
     * {@link @xeokit/scene!TextureSet | TextureSets} in the SceneModel.
     */
    textureSets?: TextureSetParams[];

    /**
     * {@link @xeokit/scene!Mesh | Meshes} in the SceneModel.
     */
    meshes?: MeshParams[];

    /**
     * {@link @xeokit/scene!SceneObject | SceneObjects} in the SceneModel.
     */
    objects?: SceneObjectParams[];

    /**
     * If we want to view the SceneModel with a {@link @xeokit/viewer!Viewer}, an
     * optional ID of the {@link @xeokit/viewer!ViewLayer | ViewLayer} to view the SceneModel in.
     *
     * Will be "default" by default.
     */
    layerId?: string;
}