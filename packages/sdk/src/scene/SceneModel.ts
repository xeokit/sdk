import {Component, EventEmitter, SDKError} from "../core";
import {
  composeMat4, createMat4,
  eulerToQuat,
  identityMat4,
  identityQuat
} from "../matrix";
import {LinesPrimitive, PointsPrimitive, SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../constants";
import {compressGeometryParams} from "./compressGeometryParams";
import {EventDispatcher} from "strongly-typed-events";
import type {FloatArrayParam} from "../math";
import type {Scene} from "./Scene";
import {SceneGeometry} from "./SceneGeometry";
import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import type {SceneGeometryParams} from "./SceneGeometryParams";
import {SceneMesh} from "./SceneMesh";
import type {SceneMeshParams} from "./SceneMeshParams";
import type {SceneModelParams} from "./SceneModelParams";
import type {SceneModelStats} from "./SceneModelStats";
import {SceneObject} from "./SceneObject";
import type {SceneObjectParams} from "./SceneObjectParams";
import {SceneTexture} from "./SceneTexture";
import type {SceneTextureParams} from "./SceneTextureParams";
import {SceneTextureSet} from "./SceneTextureSet";
import type {SceneTextureSetParams} from "./SceneTextureSetParams";
import {CoordinateSystem} from "./CoordinateSystem";
import {createCoordinateSystemTransform} from "./createCoordinateSystemTransform";

// XGF texture types

const COLOR_TEXTURE = 0;
const METALLIC_ROUGHNESS_TEXTURE = 1;
const NORMALS_TEXTURE = 2;
const EMISSIVE_TEXTURE = 3;
const OCCLUSION_TEXTURE = 4;

// KTX2 encoding options for each texture type

const TEXTURE_ENCODING_OPTIONS: {
  [key: string]: any
} = {}

TEXTURE_ENCODING_OPTIONS[COLOR_TEXTURE] = {
  useSRGB: true,
  qualityLevel: 50,
  encodeUASTC: true,
  mipmaps: true
};

TEXTURE_ENCODING_OPTIONS[EMISSIVE_TEXTURE] = {
  useSRGB: true,
  encodeUASTC: true,
  qualityLevel: 10,
  mipmaps: false
};

TEXTURE_ENCODING_OPTIONS[METALLIC_ROUGHNESS_TEXTURE] = {
  useSRGB: false,
  encodeUASTC: true,
  qualityLevel: 50,
  mipmaps: true // Needed for GGX roughness shading
};

TEXTURE_ENCODING_OPTIONS[NORMALS_TEXTURE] = {
  useSRGB: false,
  encodeUASTC: true,
  qualityLevel: 10,
  mipmaps: false
};

TEXTURE_ENCODING_OPTIONS[OCCLUSION_TEXTURE] = {
  useSRGB: false,
  encodeUASTC: true,
  qualityLevel: 10,
  mipmaps: false
};

/**
 * Contains a model's geometry and materials.
 *
 * * Created with {@link Scene.createModel | Scene.createModel}
 * * Stored in {@link Scene.models | Scene.models}
 * * Contains {@link SceneObject | SceneObjects}, {@link SceneMesh | SceneMeshes}, {@link SceneGeometry | Geometries} and {@link SceneTexture | Textures}.
 * * View with a {@link viewer!Viewer | Viewer}
 * * Import and export various file formats
 * * Build programmatically
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export class SceneModel extends Component {

  /**
   * The {@link Scene | Scene} that contains this SceneModel.
   */
  public readonly scene: Scene;

  /**
   * Configures the SceneModel's local coordinate system.
   *
   * Internally, a matrix is created to transform coordinates between SceneModel and
   * Scene CoordinateSystems. The matrix of each {@link SceneMesh} is premultiplied by that
   * matrix, effectively transforming the SceneModel into the global coordinate system.
   */
  public readonly coordinateSystem: CoordinateSystem;

  /**
   * Caches a matrix used to transform posititions between SceneModel and Scene CoordinateSystems.
   * Each SceneMesh's matrix is pre-multiplied by this matrix to effectively move the vertex
   * positions from the SceneModel CoordinateSystem to the Scene CoordinateSystem within.
   */
  public readonly coordinateSystemMatrix: FloatArrayParam;

  /**
   * Whether IDs of {@link SceneObject | SceneObjects} are globalized.
   *
   * When globalized, the IDs are prefixed with the value of {@link SceneModel.id | SceneModel.id}
   *
   * This is ````false```` by default.
   */
  declare public readonly globalizedIds: boolean;

  /**
   * Unique ID of this SceneModel.
   *
   * SceneModel are stored against this ID in {@link Scene.models | Scene.models}.
   */
  declare public readonly id: string;

  /**
   * If we want to view this SceneModel with a {@link viewer!Viewer | Viewer}, an
   * optional ID of a {@link viewer!ViewLayer | ViewLayer} to view it in.
   */
  public readonly layerId?: string;

  /**
   * Indicates if this SceneModel has been destroyed.
   *
   * * Set ````true```` by {@link SceneModel.destroy | SceneModel.destroy}.
   * * Don't create anything more in this SceneModel once it's destroyed.
   */
  declare readonly destroyed: boolean;

  /**
   * {@link SceneGeometry | Geometries} within this SceneModel, each mapped to {@link SceneGeometry.id | SceneGeometry.id}.
   *
   * * Created by {@link SceneModel.createGeometry | SceneModel.createGeometry}.
   */
  public readonly geometries: { [key: string]: SceneGeometry };

  /**
   * {@link SceneTexture | Textures} within this SceneModel, each mapped to {@link SceneTexture.id | SceneTexture.id}.
   *
   * * Created by {@link SceneModel.createTexture | SceneModel.createTexture}.
   */
  public readonly textures: { [key: string]: SceneTexture };

  /**
   * {@link SceneTextureSet | TextureSets} within this SceneModel, each mapped to {@link SceneTextureSet.id | SceneTextureSet.id}.
   *
   * * Created by {@link SceneModel.createTextureSet | SceneModel.createTextureSet}.
   */
  public readonly textureSets: { [key: string]: SceneTextureSet };

  /**
   * {@link SceneMesh | SceneMeshes} within this SceneModel, each mapped to {@link SceneMesh.id | SceneMesh.id}.
   *
   * * Created by {@link SceneModel.createMesh | SceneModel.createMesh}.
   */
  public readonly meshes: { [key: string]: SceneMesh };

  /**
   * {@link SceneObject | SceneObjects} within this SceneModel, each mapped to {@link SceneObject.id | SceneObject.id}.
   *
   * * Created by {@link SceneModel.createObject | SceneModel.createObject}.
   */
  public readonly objects: { [key: string]: SceneObject };

  /**
   * Emits an event when this {@link SceneModel | SceneModel} has been destroyed.
   *
   * * Triggered by {@link SceneModel.destroy | SceneModel.destroy}.
   *
   * @event onDestroyed
   */
  declare public readonly onDestroyed: EventEmitter<SceneModel, null>;

  /**
   * Statistics on this SceneModel.
   */
  public readonly stats: SceneModelStats;

  /**
   * @private
   */
  constructor(scene: Scene, sceneModelParams: SceneModelParams) {
    super(scene, {
      id: sceneModelParams.id
    });

    this.scene = scene;
    this.coordinateSystem = new CoordinateSystem(this, sceneModelParams?.coordinateSystem);
    this.coordinateSystemMatrix = createCoordinateSystemTransform(this.coordinateSystem, this.scene.coordinateSystem, createMat4());
    this.globalizedIds = (!!sceneModelParams.globalizedIds);
    this.layerId = sceneModelParams.layerId;
    this.geometries = {};
    this.textures = {};
    this.textureSets = {};
    this.meshes = {};
    this.objects = {};

    this.stats = {
      numGeometries: 0,
      numLines: 0,
      numMeshes: 0,
      numObjects: 0,
      numPoints: 0,
      numTextureSets: 0,
      numTextures: 0,
      numTriangles: 0,
      numVertices: 0,
      textureBytes: 0
    };

    this.onDestroyed = new EventEmitter(new EventDispatcher<SceneModel, null>());
  }

  /**
   * Creates a new {@link SceneTexture} within this SceneModel.
   *
   * * Stores the new {@link SceneTexture} in {@link SceneModel.textures | SceneModel.textures}.
   *
   * ### Usage
   *
   * ````javascript
   * const texture = sceneModel.createTexture({
   *      id: "myColorTexture",
   *      src: // Path to JPEG, PNG, KTX2,
   *      image: // HTMLImageElement,
   *      buffers: // ArrayBuffer[] containing KTX2 MIP levels
   *      preloadColor: [1,0,0,1],
   *      flipY: false,
   *      encoding: LinearEncoding, // @xeokit/constants
   *      magFilter: LinearFilter,
   *      minFilter: LinearFilter,
   *      wrapR: ClampToEdgeWrapping,
   *      wrapS: ClampToEdgeWrapping,
   *      wrapT: ClampToEdgeWrapping,
   * });
   *
   * const textureAgain = sceneModel.textures["myColorTexture"];
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene} for more usage info.
   *
   * @param textureParams - SceneTexture creation parameters.
   * @returns *{@link SceneTexture}*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * If SceneModel has already been destroyed.
   * * Invalid SceneTextureParams were given.
   * * SceneTexture with given ID already exists in this Scene.
   */
  createTexture(textureParams: SceneTextureParams): SceneTexture | SDKError {
    if (this.destroyed) {
      return new SDKError("Cannot create SceneTexture in SceneModel - SceneModel already destroyed");
    }
    if (!textureParams.imageData && !textureParams.src && !textureParams.buffers) {
      return new SDKError("Cannot create SceneTexture in SceneModel - Parameter expected: textureParams.imageData, textureParams.src or textureParams.buffers");
    }
    if (this.textures[textureParams.id]) {
      return new SDKError(`Cannot create Texture in SceneModel - Texture already exists with this ID: ${textureParams.id}`);
    }
    if (textureParams.src) {
      const fileExt = textureParams.src.split('.').pop();
      // if (fileExt !== "jpg" && fileExt !== "jpeg" && fileExt !== "png") {
      //     console.error(`Model does not support image files with extension '${fileExt}' - won't create texture '${textureParams.id}`);
      //     return;
      // }
    }
    if (textureParams.imageData) {
      this.stats.textureBytes += (textureParams.imageData.width * textureParams.imageData.height * 4); // Guessing
    }
    const texture = new SceneTexture(textureParams);
    this.textures[textureParams.id] = texture;
    this.stats.numTextures++;
    return texture;
  }

  /**
   * Creates a new {@link SceneTextureSet} within this SceneModel.
   *
   * * Stores the new {@link SceneTextureSet} in {@link SceneModel.textureSets | SceneModel.textureSets}.
   *
   * ### Usage
   *
   * ````javascript
   * const textureSet = sceneModel.createTextureSet({
   *      id: "myTextureSet",
   *      colorTextureId: "myColorTexture"
   * });
   *
   * const textureSetAgain = sceneModel.textureSets["myTextureSet"];
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param textureSetParams SceneTextureSet creation parameters.
   *
   * @returns *{@link SceneTextureSet}*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * If SceneModel has already been destroyed.
   * * Invalid SceneTextureSetParams were given.
   * * SceneTextureSet with given ID already exists in this SceneModel.
   * * One or more of the given Textures could not be found in this SceneModel.
   */
  createTextureSet(textureSetParams: SceneTextureSetParams): SceneTextureSet | SDKError {
    if (this.destroyed) {
      return new SDKError("Cannot create SceneTextureSet in SceneModel - SceneModel already destroyed");
    }
    if (this.textureSets[textureSetParams.id]) {
      return new SDKError(`Cannot create TextureSet in SceneModel - TextureSet already exists with this ID: ${textureSetParams.id}`);
    }
    let colorTexture;
    if (textureSetParams.colorTextureId !== undefined && textureSetParams.colorTextureId !== null) {
      colorTexture = this.textures[textureSetParams.colorTextureId];
      if (!colorTexture) {
        return new SDKError(`Cannot create TextureSet in SceneModel - Texture not found: ${textureSetParams.colorTextureId} - ensure that you create it first with createTexture()`);
      }
      colorTexture.channel = COLOR_TEXTURE;
    }
    let metallicRoughnessTexture;
    if (textureSetParams.metallicRoughnessTextureId !== undefined && textureSetParams.metallicRoughnessTextureId !== null) {
      metallicRoughnessTexture = this.textures[textureSetParams.metallicRoughnessTextureId];
      if (!metallicRoughnessTexture) {
        return new SDKError(`Cannot create TextureSet in SceneModel - Texture not found: ${textureSetParams.metallicRoughnessTextureId} - ensure that you create it first with createTexture()`);
      }
      metallicRoughnessTexture.channel = METALLIC_ROUGHNESS_TEXTURE;
    }
    let normalsTexture;
    if (textureSetParams.normalsTextureId !== undefined && textureSetParams.normalsTextureId !== null) {
      normalsTexture = this.textures[textureSetParams.normalsTextureId];
      if (!normalsTexture) {
        return new SDKError(`Cannot create TextureSet in SceneModel - Texture not found: ${textureSetParams.normalsTextureId} - ensure that you create it first with createTexture()`);
      }
      normalsTexture.channel = NORMALS_TEXTURE;
    }
    let emissiveTexture;
    if (textureSetParams.emissiveTextureId !== undefined && textureSetParams.emissiveTextureId !== null) {
      emissiveTexture = this.textures[textureSetParams.emissiveTextureId];
      if (!emissiveTexture) {
        return new SDKError(`Cannot create TextureSet in SceneModel - Texture not found: ${textureSetParams.emissiveTextureId} - ensure that you create it first with createTexture()`);
      }
      emissiveTexture.channel = EMISSIVE_TEXTURE;
    }
    let occlusionTexture;
    if (textureSetParams.occlusionTextureId !== undefined && textureSetParams.occlusionTextureId !== null) {
      occlusionTexture = this.textures[textureSetParams.occlusionTextureId];
      if (!occlusionTexture) {
        return new SDKError(`Cannot create TextureSet in SceneModel - Texture not found: ${textureSetParams.occlusionTextureId} - ensure that you create it first with createTexture()`);
      }
      occlusionTexture.channel = OCCLUSION_TEXTURE;
    }
    const textureSet = new SceneTextureSet(textureSetParams, {
      emissiveTexture,
      occlusionTexture,
      metallicRoughnessTexture,
      colorTexture
    });
    this.textureSets[textureSetParams.id] = textureSet;
    this.stats.numTextureSets++;
    return textureSet;
  }

  /**
   * Creates a new {@link SceneGeometry} within this SceneModel, from non-compressed geometry parameters.
   *
   * * Stores the new {@link SceneGeometry} in {@link SceneModel.geometries | SceneModel.geometries}.
   *
   * ### Usage
   *
   * ````javascript
   * const boxGeometry = sceneModel.createGeometry({
   *      id: "boxGeometry",
   *      primitive: TrianglesPrimitive, // @xeokit/constants
   *      positions: [
   *          1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, // v0-v1-v2-v3 front
   *          1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, // v0-v3-v4-v1 right
   *          1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, // v0-v1-v6-v1 top
   *          -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, // v1-v6-v7-v2 left
   *          -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,// v7-v4-v3-v2 bottom
   *          1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1 // v4-v7-v6-v1 back
   *      ],
   *      indices: [
   *          0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
   *          16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
   *      ]
   *  });
   *
   * if (boxGeometry instanceof SDKError) {
   *     console.log(boxGeometry.message);
   * } else {
   *      const boxGeometryAgain = sceneModel.geometries["boxGeometry"];
   * }
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param geometryParams Non-compressed geometry parameters.
   * @returns *{@link SceneGeometry}*
   *  * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * If this SceneModel has already been destroyed.
   * * Invalid SceneGeometryParams were given.
   * * SceneGeometry of given ID already exists in this SceneModel.
   * * Unsupported primitive type given.
   * * Mandatory vertex positions were not given. Vertex positions are mandatory for all primitive types.
   * * Mandatory indices were not given for primitive type that is not {@link constants!PointsPrimitive}. Indices are mandatory for all primitive types except PointsPrimitive.
   * * Indices out of range of vertex positions.
   * * Indices out of range of vertex UVs.
   * * Mismatch between given quantities of vertex positions and UVs.
   */
  createGeometry(geometryParams: SceneGeometryParams): SceneGeometry | SDKError {
    if (this.destroyed) {
      return new SDKError("Cannot create SceneGeometry: SceneModel already destroyed");
    }
    if (!geometryParams) {
      return new SDKError("Cannot create SceneGeometry: Missing required 'geometryParams'.");
    }
    if (geometryParams.id === null || geometryParams.id === undefined) {
      return new SDKError("Cannot create SceneGeometry: Missing required 'id' in geometryParams.");
    }
    if (this.geometries[geometryParams.id]) {
      return new SDKError(`Cannot create SceneGeometry: A geometry with ID '${geometryParams.id}' already exists in this SceneModel.`);
    }
    if (!geometryParams.positions) {
      return new SDKError("Cannot create SceneGeometry: Missing required 'positions' in geometryParams.");
    }
    if (!geometryParams.indices && geometryParams.primitive !== PointsPrimitive) {
      return new SDKError("Cannot create SceneGeometry: Missing required 'indices' for the specified primitive type.");
    }
    const geometryId = geometryParams.id;
    const primitive = geometryParams.primitive;
    if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
      return new SDKError(`Cannot create SceneGeometry: Unsupported value for geometryParams.primitive: '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
    }
    if (geometryParams.uvs) {
      if (geometryParams.uvs.length / 2 !== geometryParams.positions.length / 3) {
        return new SDKError("Cannot create SceneGeometry: Mismatch between given quantities of vertex positions and UVs");
      }
    }
    if (geometryParams.indices) {
      const lastPositionsIdx = geometryParams.positions.length / 3;
      for (let i = 0, len = geometryParams.indices.length; i < len; i++) {
        const idx = geometryParams.indices[i];
        if (idx < 0 || idx >= lastPositionsIdx) {
          return new SDKError("Cannot create SceneGeometry: indices out of range of vertex positions");
        }
        if (geometryParams.uvs) {
          const lastUVsIdx = geometryParams.uvs.length / 2;
          if (idx < 0 || idx >= lastUVsIdx) {
            return new SDKError("Cannot create SceneGeometry: indices out of range of vertex UVs");
          }
        }
      }
    }
    const sceneGeometry = new SceneGeometry(this, <SceneGeometryCompressedParams>compressGeometryParams(geometryParams));
    this.geometries[geometryId] = sceneGeometry;
    this.stats.numGeometries++;
    if (geometryParams.indices) {
      if (sceneGeometry.primitive === TrianglesPrimitive) {
        this.stats.numTriangles += geometryParams.indices.length / 3;
      } else if (sceneGeometry.primitive === LinesPrimitive) {
        this.stats.numLines += geometryParams.indices.length / 2;
      }
    } else if (sceneGeometry.primitive === PointsPrimitive) {
      this.stats.numPoints += geometryParams.positions.length / 3;
    }
    this.stats.numVertices += geometryParams.positions.length / 3;
    this.scene.onGeometryCreated.dispatch(this.scene, sceneGeometry);
    return sceneGeometry;
  }

  /**
   * Creates a new {@link SceneGeometry} within this SceneModel, from pre-compressed geometry parameters.
   *
   * * Stores the new {@link SceneGeometry} in {@link SceneModel.geometries | SceneModel.geometries}.
   * * Use {@link compressGeometryParams | compressGeometryParams} to pre-compress {@link SceneGeometryParams | SceneGeometryParams}
   * into {@link SceneGeometryCompressedParams | SceneGeometryCompressedParams}.
   *
   * ### Usage
   *
   * ````javascript
   * const boxGeometry = sceneModel.createGeometryCompressed({
   *      id: "boxGeometry",
   *      primitive: TrianglesPrimitive, // @xeokit/constants
   *      aabb: [-1,-1,-1, 1,1,1],
   *      positionsCompressed: [
   *          65525, 65525, 65525, 0, 65525, 65525, 0, 0,
   *          65525, 65525, 0, 65525, 65525, 0, 0, 65525,
   *          65525, 0, 0, 65525, 0, 0, 0, 0
   *      ],
   *      indices: [
   *          0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
   *          0, 6, 1, 1, 6, 7, 1, 7, 2, 7, 4, 3, 7, 3, 2,
   *          4, 7, 6, 4, 6, 5
   *      ]
   * });
   *
   * if (boxGeometry instanceof SDKError) {
   *     console.log(boxGeometry.message);
   * } else {
   *      const boxGeometryAgain = sceneModel.geometries["boxGeometry"];
   * }
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param geometryCompressedParams Pre-compressed geometry parameters.
   * @returns *{@link SceneGeometry}*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * If this SceneModel has already been destroyed.
   * * Invalid SceneGeometryParams were given.
   * * SceneGeometry of given ID already exists in this SceneModel.
   * * Unsupported primitive type given.
   * * Mandatory vertex positions were not given. Vertex positions are mandatory for all primitive types.
   * * Mandatory indices were not given for primitive type that is not {@link constants!PointsPrimitive}. Indices are mandatory for all primitive types except PointsPrimitive.
   * * Indices out of range of vertex positions.
   * * Indices out of range of vertex UVs.
   * * Mismatch between given quantities of vertex positions and UVs.
   */
  createGeometryCompressed(geometryCompressedParams: SceneGeometryCompressedParams): SceneGeometry | SDKError {
    if (this.destroyed) {
      return new SDKError("Cannot add compressed SceneSceneGeometry: SceneModel already destroyed");
    }
    if (!geometryCompressedParams) {
      return new SDKError("Cannot add compressed SceneSceneGeometry: Parameters expected: geometryCompressedParams");
    }
    const geometryId = geometryCompressedParams.id;
    if (this.geometries[geometryId]) {
      return new SDKError(`Cannot add compressed SceneGeometry: SceneGeometry with this ID already created: ${geometryId}`);
    }
    const primitive = geometryCompressedParams.primitive;
    if (primitive !== PointsPrimitive && primitive !== LinesPrimitive && primitive !== TrianglesPrimitive && primitive !== SolidPrimitive && primitive !== SurfacePrimitive) {
      return new SDKError(`Cannot add compressed SceneGeometry: Unsupported value for geometryCompressedParams.primitive: '${primitive}' - supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive`);
    }
    const sceneGeometry = new SceneGeometry(this, geometryCompressedParams);
    this.geometries[geometryId] = sceneGeometry;
    this.stats.numGeometries++;
    this.scene.onGeometryCreated.dispatch(this.scene, sceneGeometry);
    return sceneGeometry;
  }

  /**
   * @private
   */
  _destroyGeometry(sceneGeometry: SceneGeometry): void | SDKError {
    const geometryId = sceneGeometry.id;
    if (this.destroyed) {
      return new SDKError(`Cannot destroy SceneGeometry ${geometryId} - SceneModel already destroyed`);
    }
    if (!this.geometries[geometryId]) {
      return new SDKError(`Cannot destroy SceneGeometry ${geometryId} - SceneGeometry not found in SceneModel`);
    }
    if (sceneGeometry.numMeshes > 0) {
      return new SDKError(`Cannot destroy SceneGeometry ${geometryId} - SceneGeometry is currently used by at least one SceneMesh, which you need to destroy first`);
    }
    delete this.geometries[geometryId];
    this.stats.numGeometries--;
    if (sceneGeometry.indices) {
      // TODO: This will break when SceneModel does not retain dtxMemory-resident data
      if (sceneGeometry.primitive === TrianglesPrimitive) {
        this.stats.numTriangles += sceneGeometry.indices.length / 3;
      } else if (sceneGeometry.primitive === LinesPrimitive) {
        this.stats.numLines += sceneGeometry.indices.length / 2;
      }
    } else if (sceneGeometry.primitive === PointsPrimitive) {
      this.stats.numPoints += sceneGeometry.positionsCompressed.length / 3;
    }
    this.stats.numVertices += sceneGeometry.positionsCompressed.length / 3;
  }

  /**
   * Creates a new {@link SceneMesh} within this SceneModel.
   *
   * * Stores the new {@link SceneMesh} in {@link SceneModel.meshes | SceneModel.meshes}.
   * * A {@link SceneMesh} can be owned by one {@link SceneObject}, which can own multiple {@link SceneMesh}es.
   *
   * ### Usage
   *
   * ````javascript
   * const redBoxMesh = sceneModel.createLayerMesh({
   *      id: "redBoxMesh",
   *      geometryId: "boxGeometry",
   *      textureSetId: "myTextureSet",
   *      position: [-4, -6, -4],
   *      scale: [1, 3, 1],
   *      rotation: [0, 0, 0],
   *      color: [1, 0.3, 0.3]
   * });
   *
   * if (redBoxMesh instanceof SDKError) {
   *      console.log(redBoxMesh.message);
   * } else {
   *      const redBoxMeshAgain = sceneModel.meshes["redBoxMesh"];
   * }
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param meshParams Pre-compressed mesh parameters.
   * @returns *{@link SceneMesh}*
   *  * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * If this SceneModel has already been destroyed.
   * * Invalid SceneMeshParams were given.
   * * SceneMesh of given ID already exists in this SceneModel.
   * * Specified SceneGeometry could not be found in this SceneModel.
   * * Specified SceneTextureSet could not be found in this SceneModel.
   */
  createMesh(meshParams: SceneMeshParams): SceneMesh | SDKError {
    if (this.destroyed) {
      return new SDKError("Cannot create SceneMesh: SceneModel already destroyed");
    }
    if (this.meshes[meshParams.id]) {
      return new SDKError(`Cannot create SceneMesh: SceneMesh already exists with this ID: ${meshParams.id}`);
    }
    const geometry = this.geometries[meshParams.geometryId];
    if (!geometry) {
      return new SDKError(`Cannot create SceneMesh: SceneGeometry not found: ${meshParams.geometryId}`);
    }
    const textureSet = meshParams.textureSetId ? this.textureSets[meshParams.textureSetId] : undefined;
    if (meshParams.textureSetId && !textureSet) {
      return new SDKError(`Cannot create SceneMesh: TextureSet not found: ${meshParams.textureSetId}`);
    }
    let matrix = meshParams.matrix;
    if (!matrix) {
      const position = meshParams.position;
      const scale = meshParams.scale;
      const rotation = meshParams.rotation;
      const quaternion = meshParams.quaternion;
      if (position || scale || rotation || quaternion) {
        matrix = identityMat4();
        composeMat4(position || [0, 0, 0], quaternion || eulerToQuat(rotation || [0, 0, 0], "XYZ", identityQuat()), scale || [1, 1, 1], matrix)
      } else {
        matrix = identityMat4();
      }
    } else {
      matrix = matrix.slice();
    }
    const sceneMesh = new SceneMesh({
      id: meshParams.id,
      model: this,
      geometry,
      textureSet,
      matrix,
      color: meshParams.color,
      opacity: meshParams.opacity
    });
    geometry.numMeshes++;
    this.meshes[meshParams.id] = sceneMesh;
    this.stats.numMeshes++;
    this.scene.onMeshCreated.dispatch(this.scene, sceneMesh);
    return sceneMesh;
  }

  /**
   * @private
   */
  _destroyMesh(sceneMesh: SceneMesh): void | SDKError {
    const meshId = sceneMesh.id;
    if (this.destroyed) {
      return new SDKError(`Cannot destroy SceneMesh ${meshId} - SceneModel already destroyed`);
    }
    if (!this.meshes[meshId]) {
      return new SDKError(`Cannot destroy SceneMesh ${meshId} - SceneMesh not found in SceneModel`);
    }
    if (sceneMesh.object) {
      return new SDKError(`Cannot destroy SceneMesh ${meshId} - SceneMesh is currently used by SceneObject ${sceneMesh.object.id}, which you need to destroy first`);
    }
    if (sceneMesh.geometry) {
      sceneMesh.geometry.numMeshes--;
    }
    delete this.meshes[meshId];
    this.stats.numMeshes--;
    this.scene.onMeshDestroyed.dispatch(this.scene, sceneMesh);
  }

  /**
   * Creates a new {@link SceneObject}.
   *
   * * Stores the new {@link SceneObject} in {@link SceneModel.objects | SceneModel.objects} and {@link Scene.objects | Scene.objects}.
   * * Each {@link SceneMesh} is allowed to belong to one SceneObject.
   * * SceneObject IDs must be unique within the SceneModel's {@link Scene | Scene}.
   *
   * ### Usage
   *
   * ````javascript
   * const redBoxObject = sceneModel.createObject({
   *     id: "redBoxObject",
   *     meshIds: ["redBoxMesh"]
   * });
   *
   * if (redBoxObject instanceof SDKError) {
   *      console.log(redBoxObject.message);
   * } else {
   *      const redBoxObjectAgain = sceneModel.objects["redBoxObject"];
   *      const redBoxObjectOnceMore = scene.objects["redBoxObject"];
   * }
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param objectParams SceneObject parameters.
   * @returns *{@link SceneObject}*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * If this SceneModel has already been destroyed.
   * * Invalid ObjectParams were given.
   * * SceneObject of given ID already exists in this SceneModel's Scene. Note that SceneObject IDs must be unique within the Scene.
   * * No Meshes were specified.
   * * One or more of the specified Meshes already belong to another SceneObject in this SceneModel.
   * * Specified Meshes could not be found in this SceneModel.
   */
  createObject(objectParams: SceneObjectParams): SceneObject | SDKError {
    if (this.destroyed) {
      return new SDKError("Cannot create SceneObject - SceneModel already destroyed");
    }
    if (objectParams.meshIds.length === 0) {
      return new SDKError("Cannot create SceneObject - no meshes specified");
    }
    const objectId = this.globalizedIds ? `${this.id}.${objectParams.id}` : objectParams.id;
    if (this.scene.objects[objectId]) {
      return new SDKError(`Cannot create SceneObject - SceneObject already exists: ${objectId}`);
    }
    const meshIds = objectParams.meshIds;
    const meshes = [];
    for (let meshIdIdx = 0, meshIdLen = meshIds.length; meshIdIdx < meshIdLen; meshIdIdx++) {
      const meshId = meshIds[meshIdIdx];
      const mesh = this.meshes[meshId];
      if (!mesh) {
        return new SDKError(`Cannot create SceneObject - SceneMesh not found: ${meshId}`);
      }
      if (mesh.object) {
        return new SDKError(`Cannot create SceneObject - SceneMesh ${meshId} already belongs to existing SceneObject ${mesh.object.id}`);
      }
      meshes.push(mesh);
    }
    const sceneObject = new SceneObject({
      id: objectId,
      originallSystemId: objectParams.originalSystemId,
      layerId: this.layerId || objectParams.layerId,
      model: this,
      meshes
    });
    for (let i = 0, len = meshes.length; i < len; i++) {
      const mesh = meshes[i];
      mesh.object = sceneObject;
    }
    this.objects[objectId] = sceneObject;
    this.stats.numObjects++;
    this.scene._registerObject(sceneObject);
    return sceneObject;
  }

  /**
   * @private
   */
  _destroyObject(sceneObject: SceneObject): void | SDKError {
    const objectId = sceneObject.id;
    if (this.destroyed) {
      return new SDKError(`Cannot destroy SceneObject ${objectId} - SceneModel already destroyed`);
    }
    if (!this.objects[objectId]) {
      return new SDKError(`Cannot destroy SceneObject ${objectId} - SceneObject not found in SceneModel`);
    }
    const meshes = sceneObject.meshes;
    for (let i = 0, len = meshes.length; i < len; i++) {
      const mesh = meshes[i];
      mesh.object = null;
    }
    delete this.objects[objectId];
    this.stats.numObjects--;
    this.scene._deregisterObject(sceneObject);
  }

  /**
   * Creates components in this SceneModel from SceneModelParams.
   *
   * See {@link scene | @xeokit/sdk/scene} for usage.
   *
   * @param sceneModelParams
   * @returns *void*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * If this SceneModel has already been destroyed.
   * * A duplicate component ({@link SceneObject}, {@link SceneMesh},
   * {@link SceneGeometry}, {@link SceneTexture} etc.) was already created within this SceneModel.
   */
  fromParams(sceneModelParams: SceneModelParams): void | SDKError {
    if (this.destroyed) {
      return new SDKError("Cannot add components to SceneModel - SceneModel already destroyed");
    }
    if (sceneModelParams.geometries) {
      for (let i = 0, len = sceneModelParams.geometries.length; i < len; i++) {
        this.createGeometry(sceneModelParams.geometries[i]);
      }
    }
    if (sceneModelParams.geometriesCompressed) {
      for (let i = 0, len = sceneModelParams.geometriesCompressed.length; i < len; i++) {
        this.createGeometryCompressed(sceneModelParams.geometriesCompressed[i]);
      }
    }
    if (sceneModelParams.textures) {
      for (let i = 0, len = sceneModelParams.textures.length; i < len; i++) {
        this.createTexture(sceneModelParams.textures[i]);
      }
    }
    if (sceneModelParams.textureSets) {
      for (let i = 0, len = sceneModelParams.textureSets.length; i < len; i++) {
        this.createTextureSet(sceneModelParams.textureSets[i]);
      }
    }
    if (sceneModelParams.meshes) {
      for (let i = 0, len = sceneModelParams.meshes.length; i < len; i++) {
        this.createMesh(sceneModelParams.meshes[i]);
      }
    }
    if (sceneModelParams.objects) {
      for (let i = 0, len = sceneModelParams.objects.length; i < len; i++) {
        this.createObject(sceneModelParams.objects[i]);
      }
    }
  }

  /**
   * Gets this SceneModel as SceneModelParams.
   *
   * See {@link scene | @xeokit/sdk/scene} for usage.
   */
  toParams(): SceneModelParams {
    const sceneModelParams = <SceneModelParams>{
      id: this.id,
      geometriesCompressed: [],
      textures: [],
      textureSets: [],
      transforms: [],
      meshes: [],
      objects: []
    };
    Object.entries(this.geometries).forEach(([key, sceneGeometry]) => {
      sceneModelParams.geometriesCompressed.push((<SceneGeometry>sceneGeometry).toParams());
    });
    // Object.entries(this.textures).forEach(([key, value]) => {
    //     sceneModelParams.textures[key] = (<SceneTexture>value).toParams();
    // });
    // Object.entries(this.textureSets).forEach(([key, value]) => {
    //     sceneModelParams.textureSets[key] = (<SceneTextureSet>value).toParams();
    // });
    Object.entries(this.meshes).forEach(([key, sceneMesh]) => {
      sceneModelParams.meshes.push((<SceneMesh>sceneMesh).toParams());
    });
    Object.entries(this.objects).forEach(([key, sceneObject]) => {
      sceneModelParams.objects.push((<SceneObject>sceneObject).toParams());
    });
    return sceneModelParams;
  }

  /**
   * Destroys this SceneModel.
   *
   * Sets {@link Component.destroyed} ````true````.
   */
  destroy() {
    if (this.destroyed) {
      return;
    }
    this.onDestroyed.dispatch(this, null);
    super.destroy();
  }
}
