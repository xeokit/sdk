import type {FloatArrayParam} from "@xeokit/math";

import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import type {SceneTextureParams} from "./SceneTextureParams";
import type {SceneTextureSetParams} from "./SceneTextureSetParams";

import type {SceneMeshParams} from "./SceneMeshParams";
import type {SceneGeometryParams} from "./SceneGeometryParams";
import type {SceneObjectParams} from "./SceneObjectParams";
import {SceneModelStreamParams} from "./SceneModelStreamParams";


/**
 * {@link @xeokit/scene!SceneModel | SceneModel} creation parameters for {@link @xeokit/scene!Scene.createModel | Scene.createModel}.
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export interface SceneModelParams {

    /**
     * Indicates what renderer resources will need to be allocated in a {@link @xeokit/viewer!Viewer | Viewer's}
     * {@link @xeokit/viewer!Renderer | Renderer} to support progressive loading for a {@link @xeokit/scene!SceneModel | SceneModel}.
     */
    streamParams?: SceneModelStreamParams;

    /**
     * Unique ID for the SceneModel.
     *
     * The SceneModel is stored with this ID in {@link @xeokit/scene!Scene.models | Scene.models}
     */
    id: string;

    /**
     * Whether IDs of the {@link @xeokit/scene!SceneObject | SceneObjects} are globalized.
     *
     * When globalized, the IDs are prefixed with the value of {@link @xeokit/scene!SceneModel.id | SceneModel.id}
     *
     * Default is ````false````.
     */
    globalizedIds?: boolean

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
     * {@link @xeokit/scene!SceneGeometryParams} in the SceneModel.
     */
    geometries?: SceneGeometryParams[];

    /**
     * {@link @xeokit/scene!SceneGeometryCompressedParams | SceneGeometryCompressedParams} in the SceneModel.
     */
    geometriesCompressed?: SceneGeometryCompressedParams[];

    /**
     * {@link @xeokit/scene!SceneTexture | Textures} in the SceneModel.
     */
    textures?: SceneTextureParams[];

    /**
     * {@link @xeokit/scene!SceneTextureSet | TextureSets} in the SceneModel.
     */
    textureSets?: SceneTextureSetParams[];

    /**
     * {@link @xeokit/scene!SceneMesh | Meshes} in the SceneModel.
     */
    meshes?: SceneMeshParams[];

    /**
     * {@link @xeokit/scene!SceneObject | SceneObjects} in the SceneModel.
     */
    objects?: SceneObjectParams[];

    /**
     * If we want to view the SceneModel with a {@link @xeokit/viewer!Viewer | Viewer}, an
     * optional ID of the {@link @xeokit/viewer!ViewLayer | ViewLayer} to view the SceneModel in.
     *
     * Will be "default" by default.
     *
     * Overrides {@link @xeokit/scene!SceneObjectParams.layerId | SceneObjectParams.layerId}.
     */
    layerId?: string;

    /**
     * TODO
     */
    retained?: boolean;
}
