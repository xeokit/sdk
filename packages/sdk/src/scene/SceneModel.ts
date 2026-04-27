import {SDKErrorType, SDKInternalException, type SDKResult} from "../core";
import {composeMat4, createMat4Float64, identityMat4, type  Mat4} from "../math/matrix";
import {eulerToQuat, identityQuat} from "../math/quat";
import {LinesPrimitive, PointsPrimitive, SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../constants";
import {compressGeometryParams} from "./compressGeometryParams";
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
import {SceneMaterial} from "./SceneMaterial";
import type {SceneMaterialParams} from "./SceneMaterialParams";
import {CoordinateSystem} from "./CoordinateSystem";
import {createCoordinateSystemTransform} from "./createCoordinateSystemTransform";
import {SceneTransform} from "./SceneTransform";
import {type SceneTransformParams} from "./SceneTransformParams";


/**
 * Texture channel for base color (albedo). Interpreted as sRGB.
 * Used by {@link SceneTexture.channel} when the texture is bound as the color map.
 */
const COLOR_TEXTURE = 0;

/**
 * Texture channel for combined metallic (B) and roughness (G) workflow.
 * Linear color space. Mipmaps recommended for correct GGX roughness.
 */
const METALLIC_ROUGHNESS_TEXTURE = 1;

/**
 * Texture channel for tangent-space normals. Linear color space.
 */
const NORMALS_TEXTURE = 2;

/**
 * Texture channel for emissive color. Interpreted as sRGB.
 */
const EMISSIVE_TEXTURE = 3;

/**
 * Texture channel for ambient occlusion. Linear color space.
 */
const OCCLUSION_TEXTURE = 4;

/**
 * Default KTX2 encoding options per texture channel.
 *
 * These are applied when the SDK encodes supplied image sources to KTX2.
 * Values are tuned for typical real-time use and may be overridden by
 * encoders/higher layers.
 *
 * @remarks
 * Keys are the numeric channel constants above (0–4). Each option object is
 * passed to the KTX2 encoder (e.g. Basis Universal) and may include:
 * - `useSRGB` — whether to store in sRGB transfer function
 * - `encodeUASTC` — whether to use UASTC mode
 * - `qualityLevel` — encoder quality hint
 * - `mipmaps` — whether to generate mip levels
 */
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
 * - Created with {@link Scene.createModel | Scene.createModel}
 * - Stored in {@link Scene.models | Scene.models}
 * - Contains {@link SceneObject | SceneObjects}, {@link SceneMesh | SceneMeshes},
 *   {@link SceneGeometry | Geometries} and {@link SceneTexture | Textures}.
 * - View with a {@link viewer!Viewer | Viewer}
 * - Import and export various file formats
 * - Build programmatically
 *
 * See {@link scene | @xeokit/sdk/scene} for usage.
 */
export class SceneModel {

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

  private _coordinateSystemMatrix: Mat4;
  private _coordinateSystemMatrixDirty: boolean = true;

  /**
   * Whether IDs of {@link SceneObject | SceneObjects} are globalized.
   *
   * When globalized, the IDs are prefixed with the value of {@link SceneModel.id | SceneModel.id}
   *
   * This is ````false```` by default.
   */
  public readonly globalizedIds: boolean;

  /**
   * Unique ID of this SceneModel.
   *
   * SceneModel are stored against this ID in {@link Scene.models | Scene.models}.
   */
  public readonly id: string;

  /**
   * If we want to view this SceneModel with a {@link viewer!Viewer | Viewer}, an
   * optional ID of a {@link viewer!ViewLayer | ViewLayer} to view it in.
   */
  public readonly layerId?: string;

  /**
   * {@link SceneTransform | SceneTransforms} within this SceneModel, each mapped to {@link SceneTransform.id | SceneTransform.id}.
   *
   * - Created by {@link SceneModel.createTransform | SceneModel.createTransform}.
   */
  public readonly transforms: { [key: string]: SceneTransform };

  /**
   * {@link SceneGeometry | Geometries} within this SceneModel, each mapped to {@link SceneGeometry.id | SceneGeometry.id}.
   *
   * - Created by {@link SceneModel.createGeometry | SceneModel.createGeometry}.
   */
  public readonly geometries: { [key: string]: SceneGeometry };

  /**
   * {@link SceneTexture | Textures} within this SceneModel, each mapped to {@link SceneTexture.id | SceneTexture.id}.
   *
   * - Created by {@link SceneModel.createTexture | SceneModel.createTexture}.
   */
  public readonly textures: { [key: string]: SceneTexture };

  /**
   * {@link SceneMaterial | Materials} within this SceneModel, each mapped to {@link SceneMaterial.id | SceneMaterial.id}.
   *
   * - Created by {@link SceneModel.createMaterial | SceneModel.createMaterial}.
   */
  public readonly materials: { [key: string]: SceneMaterial };

  /**
   * {@link SceneMesh | SceneMeshes} within this SceneModel, each mapped to {@link SceneMesh.id | SceneMesh.id}.
   *
   * - Created by {@link SceneModel.createMesh | SceneModel.addMesh}.
   */
  public readonly meshes: { [key: string]: SceneMesh };

  /**
   * {@link SceneObject | SceneObjects} within this SceneModel, each mapped to {@link SceneObject.id | SceneObject.id}.
   *
   * - Created by {@link SceneModel.createObject | SceneModel.createObject}.
   */
  public readonly objects: { [key: string]: SceneObject };

  private _streamingEnabled: boolean;

  private _finalized: boolean;

  /**
   * Statistics on this SceneModel.
   *
   * @remarks
   * Values are updated as content is created/destroyed:
   * - `numTransforms`, `numGeometries`, `numMeshes`, `numObjects`
   * - `numVertices`, `numTriangles`, `numLines`, `numPoints`
   * - `numTextures`, `numMaterials`, `textureBytes`
   */
  public readonly stats: SceneModelStats;

  /**
   * Indicates if this SceneModel has been destroyed.
   *
   * - Set ````true```` by {@link SceneModel.destroy | SceneModel.destroy}.
   * - Don't create anything more in this SceneModel once it's destroyed.
   */
  public destroyed: boolean = false;

  /**
   * Constructs a new {@link SceneModel}.
   *
   * @param scene The owning {@link Scene}.
   * @param sceneModelParams Initialization parameters.
   *
   * @remarks
   * The model’s local {@link coordinateSystem} is established here, and a cached
   * {@link coordinateSystemMatrix} is computed so that any created {@link SceneMesh}
   * has its local matrix pre-multiplied into the Scene coordinate system.
   *
   * The `globalizedIds` flag controls whether created {@link SceneObject} IDs
   * are automatically prefixed with the model ID when registered in the Scene.
   *
   * @private
   */
  constructor(scene: Scene, sceneModelParams: SceneModelParams) {
    this.id = sceneModelParams.id;
    this.scene = scene;
    this.coordinateSystem = new CoordinateSystem(
      this,
      () => { // Updated
        this._coordinateSystemMatrixDirty = true;
        this.setWorldMatrixDirty();
      },
      sceneModelParams?.coordinateSystem);
    this._streamingEnabled = sceneModelParams?.streamingEnabled !== false;
    this._finalized = false;
    this._coordinateSystemMatrix = createMat4Float64();
    this._coordinateSystemMatrixDirty = true;
    this.globalizedIds = (!!sceneModelParams.globalizedIds);
    this.layerId = sceneModelParams.layerId;
    this.transforms = {};
    this.geometries = {};
    this.textures = {};
    this.materials = {};
    this.meshes = {};
    this.objects = {};

    this.stats = {
      numTransforms: 0,
      numGeometries: 0,
      numLines: 0,
      numMeshes: 0,
      numObjects: 0,
      numPoints: 0,
      numMaterials: 0,
      numTextures: 0,
      numTriangles: 0,
      numVertices: 0,
      textureBytes: 0
    };
  }

  /**
   * Indicates whether streaming is enabled for this SceneModel.
   */
  get streamingEnabled(): boolean {
    return this._streamingEnabled;
  }

  /**
   * Indicates whether this SceneModel has been finalized.
   */
  get finalized() : boolean {
    return this._finalized;
  }

  /**
   * Caches a matrix used to transform positions between SceneModel and Scene CoordinateSystems.
   * Each SceneMesh's matrix is pre-multiplied by this matrix to effectively move the vertex
   * positions from the SceneModel CoordinateSystem to the Scene CoordinateSystem within.
   */
  get coordinateSystemMatrix(): Mat4 {
    if (this._coordinateSystemMatrixDirty) {
      this._coordinateSystemMatrix = createCoordinateSystemTransform(this.coordinateSystem, this.scene.coordinateSystem, this._coordinateSystemMatrix);
      this._coordinateSystemMatrixDirty = false;
    }
    return this._coordinateSystemMatrix;
  }

  /**
   * Creates a new {@link SceneTransform} within this SceneModel.
   *
   * - Stores the transform in {@link SceneModel.transforms}.
   * - Optionally attaches it under a parent transform using {@link SceneTransform.setParentTransformId}.
   * - The final transform matrix can be supplied directly via `matrix` or composed from
   *   `position`, `scale` and `rotation` (Euler) or `quaternion`.
   * - Fires {@link SceneEvents.onSceneTransformCreated | SceneEvents.onSceneTransformCreated} event.
   *
   * @example
   * ```javascript
   * const rootTransformResult = sceneModel.createTransform({
   *   id: "root",
   *   position: [10, 0, 0]
   * });
   *
   * if (!rootTransformResult.ok) {
   *   console.error(rootTransformResult.error);
   *   return;
   * }
   *
   * const rootTransform = rootTransformResult.value;
   *
   * sceneModel.createTransform({
   *   id: "child",
   *   parentTransformId: "root",
   *   rotation: [0, Math.PI * 0.5, 0]
   * });
   *
   * const childTransform = sceneModel.transforms["child"];
   * childTransform.position = [0, 5, 0];
   * childTransform.rotation =[0, 0, 45];
   * ```
   *
   * @param transformParams Parameters describing the transform to create.
   * @returns An SDKResult with:
   * - On success, the created {@link SceneTransform}.
   * - On failure, an error message. Reasons for failure include:
   *   - SceneModel already destroyed.
   *   - SceneTransform already exists with the given ID.
   *   - Parent SceneTransform not found with the given parentTransformId.
   */
  createTransform(transformParams: SceneTransformParams): SDKResult<SceneTransform> {

    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.createTransform] SceneModel already destroyed"
      });
    }

    if (this._finalized) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneModel.createTransform] SceneModel already _finalized`
      });
    }

    if (!transformParams.id) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createTransform] Parameter expected: transformParams.id"
      });
    }

    if (this.transforms[transformParams.id]) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createTransform] SceneTransform already exists with this ID: ${transformParams.id}`
      });
    }

    let parentTransform: SceneTransform | undefined;
    if (transformParams.parentTransformId) {
      parentTransform = this.transforms[transformParams.parentTransformId];
      if (!parentTransform) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[SceneModel.createTransform] Parent SceneTransform not found: ${transformParams.parentTransformId}`
        });
      }
    }

    const sceneTransform = new SceneTransform(this, transformParams);

    if (parentTransform) {
      sceneTransform.setParentTransformId(parentTransform.id);
    }

    this.transforms[transformParams.id] = sceneTransform;
    this.stats.numTransforms++;
    if (this._streamingEnabled) {
      this.scene.events.onSceneTransformCreated.dispatch(this.scene, sceneTransform);
    }
    return {
      ok: true,
      value: sceneTransform
    };
  }

  /**
   * @private
   * Destroys a {@link SceneTransform} previously created in this model.
   */
  _destroyTransform(sceneTransform: SceneTransform) {
    const transformId = sceneTransform.id;
    if (this.destroyed) {
      throw new SDKInternalException(`Cannot destroy SceneTransform ${transformId} - SceneModel already destroyed`);
    }
    if (!this.transforms[transformId]) {
      throw new SDKInternalException(`Cannot destroy SceneTransform ${transformId} - SceneTransform not found in SceneModel`);
    }
    delete this.transforms[transformId];
    this.stats.numTransforms--;
    if (this._streamingEnabled) {
      this.scene.events.onSceneTransformDestroyed.dispatch(this.scene, sceneTransform);
    }
  }

  /**
   * Creates a new {@link SceneTexture} within this SceneModel.
   *
   * - Stores the new {@link SceneTexture} in {@link SceneModel.textures | SceneModel.textures}.
   * - Fires {@link SceneEvents.onSceneTextureCreated | SceneEvents.onSceneTextureCreated} event.
   *
   * ### Usage
   *
   * ````javascript
   * const textureResult = sceneModel.createTexture({
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
   * if (!textureResult.ok) {
   *   console.error(textureResult.error);
   *   return;
   * } else {
   *     const texture = textureResult.value;
   * }
   *
   * const textureAgain = sceneModel.textures["myColorTexture"];
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene} for more usage info.
   *
   * @param textureParams - SceneTexture creation parameters.
   * @returns SDKResult with:
   * - On success, the created {@link SceneTexture}.
   * - On failure, an error message. Reasons for failure include:
   *   - SceneModel already destroyed.
   *   - Missing required parameter: textureParams.imageData, textureParams.image, textureParams.src or textureParams.buffers.
   *   - Texture already exists with the given ID.
   *   - Unsupported image extension.
   */
  createTexture(textureParams: SceneTextureParams): SDKResult<SceneTexture> {

    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.createTexture] SceneModel already destroyed"
      });
    }
    if (this._finalized) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneModel.createTexture] SceneModel already _finalized`
      });
    }
    if (!textureParams.id) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createTexture] Parameter expected: textureParams.id"
      });
    }
    if (!textureParams.imageData && !textureParams.image && !textureParams.src && !textureParams.buffers) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error:
          "[SceneModel.createTexture] Parameter expected: textureParams.imageData, textureParams.image, textureParams.src or textureParams.buffers"
      });
    }

    if (this.textures[textureParams.id]) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createTexture] Cannot create Texture - Texture already exists with this ID: '${textureParams.id}'`
      });
    }

    if (textureParams.src) {
      const fileExt = textureParams.src.split(".").pop();
      // if (fileExt !== "jpg" && fileExt !== "jpeg" && fileExt !== "png") {
      //   return { ok: false, error: `Unsupported image extension '${fileExt}' for texture '${textureParams.id}'` };
      // }
    }

    // Rough estimate: 4 bytes per pixel (RGBA). `imageData` and `image`
    // both expose `.width` / `.height` directly; we ignore `src` (size
    // is unknown until decode) and `buffers` (compressed payload).
    const sized = textureParams.imageData || textureParams.image;
    if (sized && (sized as any).width && (sized as any).height) {
      this.stats.textureBytes += (sized as any).width * (sized as any).height * 4;
    }

    const texture = new SceneTexture(this, textureParams);
    this.textures[textureParams.id] = texture;
    this.stats.numTextures++;
    if (this._streamingEnabled) {
      this.scene.events.onSceneTextureCreated.dispatch(this.scene, texture);
    }
    return {
      ok: true,
      value: texture
    };
  }

  /**
   * Called by a {@link SceneTexture} when it is destroyed.
   * @private
   * @param sceneTexture
   */
  _destroyTexture(sceneTexture: SceneTexture) {
    const textureId = sceneTexture.id;
    if (this.destroyed) {
      throw new SDKInternalException(`Cannot destroy SceneTexture ${textureId} - SceneModel already destroyed`);
    }
    if (!this.textures[textureId]) {
      throw new SDKInternalException(`Cannot destroy SceneTexture ${textureId} - SceneTexture not found in SceneModel`);
    }
    delete this.textures[textureId];
    this.stats.numTextures--;
    this.stats.textureBytes -= sceneTexture.imageData ? (sceneTexture.imageData.width * sceneTexture.imageData.height * 4) : 0;
    if (this._streamingEnabled) {
      this.scene.events.onSceneTextureDestroyed.dispatch(this.scene, sceneTexture);
    }
  }

  /**
   * Creates a new {@link SceneMaterial} within this SceneModel.
   *
   * - Stores the new {@link SceneMaterial} in {@link SceneModel.materials | SceneModel.materials}.
   * - Fires {@link SceneEvents.onSceneMaterialCreated | SceneEvents.onSceneMaterialCreated} event.
   *
   * ### Usage
   *
   * ````javascript
   * const materialResult = sceneModel.createMaterial({
   *      id: "myMaterial",
   *      colorTextureId: "myColorTexture"
   * });
   *
   * if (!materialResult.ok) {
   *   console.error(materialResult.error);
   *   return;
   * } else {
   * const material = materialResult.value;
   * }
   *
   * const materialAgain = sceneModel.materials["myMaterial"];
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param materialParams SceneMaterial creation parameters.
   *
   * @returns SDKResult with:
   * - On success, the created {@link SceneMaterial}.
   * - On failure, an error message. Reasons for failure include:
   *  - SceneModel already destroyed.
   *  - Material already exists with the given ID.
   *  - Referenced texture not found in SceneModel.
   */
  createMaterial(materialParams: SceneMaterialParams): SDKResult<SceneMaterial> {

    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.createMaterial] Cannot create SceneMaterial - SceneModel already destroyed"
      });
    }

    if (this._finalized) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneModel.createMaterial] SceneModel already _finalized`
      });
    }

    if (this.materials[materialParams.id]) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createMaterial] Material already exists with this ID: '${materialParams.id}'`
      });
    }

    let colorTexture: SceneTexture | undefined;
    if (materialParams.colorTextureId !== undefined && materialParams.colorTextureId !== null) {
      colorTexture = this.textures[materialParams.colorTextureId];
      if (!colorTexture) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error:
            `[SceneModel.createMaterial] Texture not found: '${materialParams.colorTextureId}' - ` +
            "ensure that you create it first with createTexture()"
        });
      }
      colorTexture.channel = COLOR_TEXTURE;
    }

    let metallicRoughnessTexture: SceneTexture | undefined;
    if (materialParams.metallicRoughnessTextureId !== undefined && materialParams.metallicRoughnessTextureId !== null) {
      metallicRoughnessTexture = this.textures[materialParams.metallicRoughnessTextureId];
      if (!metallicRoughnessTexture) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error:
            `[SceneModel.createMaterial] Texture not found: '${materialParams.metallicRoughnessTextureId}' - ` +
            "ensure that you create it first with createTexture()"
        });
      }
      metallicRoughnessTexture.channel = METALLIC_ROUGHNESS_TEXTURE;
    }

    let normalsTexture: SceneTexture | undefined;
    if (materialParams.normalsTextureId !== undefined && materialParams.normalsTextureId !== null) {
      normalsTexture = this.textures[materialParams.normalsTextureId];
      if (!normalsTexture) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error:
            `[SceneModel.createMaterial] Texture not found: '${materialParams.normalsTextureId}' - ` +
            "ensure that you create it first with createTexture()"
        });
      }
      normalsTexture.channel = NORMALS_TEXTURE;
    }

    let emissiveTexture: SceneTexture | undefined;
    if (materialParams.emissiveTextureId !== undefined && materialParams.emissiveTextureId !== null) {
      emissiveTexture = this.textures[materialParams.emissiveTextureId];
      if (!emissiveTexture) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error:
            `[SceneModel.createMaterial] Texture not found: '${materialParams.emissiveTextureId}' - ` +
            "ensure that you create it first with createTexture()"
        });
      }
      emissiveTexture.channel = EMISSIVE_TEXTURE;
    }

    let occlusionTexture: SceneTexture | undefined;
    if (materialParams.occlusionTextureId !== undefined && materialParams.occlusionTextureId !== null) {
      occlusionTexture = this.textures[materialParams.occlusionTextureId];
      if (!occlusionTexture) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error:
            `[SceneModel.createMaterial] Texture not found: '${materialParams.occlusionTextureId}' - ` +
            "ensure that you create it first with createTexture()"
        });
      }
      occlusionTexture.channel = OCCLUSION_TEXTURE;
    }

    const material = new SceneMaterial(this, materialParams, {
      emissiveTexture,
      occlusionTexture,
      metallicRoughnessTexture,
      normalsTexture,
      colorTexture
    });

    this.materials[materialParams.id] = material;
    this.stats.numMaterials++;
    if (this._streamingEnabled) {
      this.scene.events.onSceneMaterialCreated.dispatch(this.scene, material);
    }
    return {
      ok: true,
      value: material
    };
  }


  /**
   * Called by a {@link SceneMaterial} when it is destroyed.
   * @private
   * @param sceneMaterial
   */
  _destroyMaterial(sceneMaterial: SceneMaterial) {
    const materialId = sceneMaterial.id;
    if (this.destroyed) {
      throw new SDKInternalException(`Cannot destroy SceneMaterial '${materialId}' - SceneModel already destroyed`);
    }
    if (!this.materials[materialId]) {
      throw new SDKInternalException(`Cannot destroy SceneMaterial '${materialId}' - SceneMaterial not found in SceneModel`);
    }
    delete this.materials[materialId];
    this.stats.numMaterials--;
    if (this._streamingEnabled) {
      this.scene.events.onSceneMaterialDestroyed.dispatch(this.scene, sceneMaterial);
    }
  }

  /**
   * Creates a new {@link SceneGeometry} within this SceneModel, from non-compressed geometry parameters.
   *
   * - Stores the new {@link SceneGeometry} in {@link SceneModel.geometries | SceneModel.geometries}.
   * - Fires {@link SceneEvents.onSceneGeometryCreated | SceneEvents.onSceneGeometryCreated} event.
   *
   * ### Usage
   *
   * ````javascript
   * const boxGeometryResult = sceneModel.createGeometry({
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
   * if (!boxGeometryResult.ok) {
   *    console.error(boxGeometryResult.error);
   *    return;
   * } else {
   *    const boxGeometry = boxGeometryResult.value;
   * }
   *
   * const boxGeometryAgain = sceneModel.geometries["boxGeometry"];
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param geometryParams Non-compressed geometry parameters.
   * @returns SDKResult with:
   * - On success, the created {@link SceneGeometry}.
   * - On failure, an error message. Reasons for failure include:
   *   - If this SceneModel has already been destroyed.
   *   - Invalid {@link SceneGeometryParams} were given.
   *   - A {@link SceneGeometry} with the given ID already exists in this SceneModel.
   *   - Unsupported primitive type was provided.
   *   - Mandatory vertex positions were not provided. Vertex positions are required for all primitive types.
   *   - Mandatory indices were not provided for primitive types other than {@link constants!PointsPrimitive}.
   *   - Indices are out of range of vertex positions.
   *   - Indices are out of range of vertex UVs.
   *   - Mismatch between the quantities of vertex positions and UVs.
   */
  createGeometry(geometryParams: SceneGeometryParams): SDKResult<SceneGeometry> {

    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.createGeometry] SceneModel already destroyed"
      });
    }

    if (this._finalized) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneModel.createGeometry] SceneModel already _finalized`
      });
    }

    if (!geometryParams) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometry] Missing required 'geometryParams'."
      });
    }

    const {id, positions, indices, primitive, uvs, colors, normals} = geometryParams;

    if (id === null || id === undefined) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometry] Missing required 'id' in geometryParams."
      });
    }

    if (this.geometries[id]) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createGeometry] A geometry with ID '${id}' already exists in this SceneModel.`
      });
    }

    if (!positions) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometry] Missing required 'positions' in geometryParams."
      });
    }

    if (positions.length === 0 ) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometry] 'positions' in geometryParams cannot be empty."
      });
    }

    if (positions.length % 3 !== 0) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometry] The length of 'positions' in geometryParams must be a multiple of 3."
      });
    }

    if (primitive !== PointsPrimitive && (!indices || indices.length===0)) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometry] Missing/empty required 'indices' for the specified primitive type."
      });
    }

    if (
      primitive !== PointsPrimitive &&
      primitive !== LinesPrimitive &&
      primitive !== TrianglesPrimitive &&
      primitive !== SolidPrimitive &&
      primitive !== SurfacePrimitive
    ) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error:
          `[SceneModel.createGeometry] Unsupported value for geometryParams.primitive: '${primitive}' - ` +
          "supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive"
      });
    }

    if (colors && colors.length > 0) {
      if (colors.length / 4 !== positions.length / 3) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: "[SceneModel.createGeometry] Mismatch between given quantities of vertex positions and colors"
        });
      }
    }

    if (uvs && uvs.length > 0) {
      if (uvs.length / 2 !== positions.length / 3) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: "[SceneModel.createGeometry] Mismatch between given quantities of vertex positions and UVs"
        });
      }
    }

    if (normals && normals.length > 0) {
      if (normals.length !== positions.length) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: "[SceneModel.createGeometry] Mismatch between given quantities of vertex positions and normals"
        });
      }
    }

    if (indices) {
      const lastPositionsIdx = positions.length / 3;
      for (let i = 0, len = indices.length; i < len; i++) {
        const idx = indices[i];
        if (idx < 0 || idx >= lastPositionsIdx) {
          return this.scene.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: "[SceneModel.createGeometry] Indices out of range of vertex positions"
          });
        }
        if (uvs) {
          const lastUVsIdx = uvs.length / 2;
          if (idx < 0 || idx >= lastUVsIdx) {
            return this.scene.logError({
              ok: false,
              type: SDKErrorType.InvalidInput,
              error: "[SceneModel.createGeometry] Indices out of range of vertex UVs"
            });
          }
        }
      }
    }

    const sceneGeometry = new SceneGeometry(
      this,
      compressGeometryParams(geometryParams) as SceneGeometryCompressedParams
    );

    this.geometries[id] = sceneGeometry;
    this.stats.numGeometries++;

    if (indices) {
      if (sceneGeometry.primitive === TrianglesPrimitive) {
        this.stats.numTriangles += indices.length / 3;
      } else if (sceneGeometry.primitive === LinesPrimitive) {
        this.stats.numLines += indices.length / 2;
      }
    } else if (sceneGeometry.primitive === PointsPrimitive) {
      this.stats.numPoints += positions.length / 3;
    }
    this.stats.numVertices += positions.length / 3;

    if (this._streamingEnabled) {
      this.scene.events.onSceneGeometryCreated.dispatch(this.scene, sceneGeometry);
    }

    return {
      ok: true,
      value: sceneGeometry
    };
  }

  /**
   * Creates a new {@link SceneGeometry} within this SceneModel, from pre-compressed geometry parameters.
   *
   * - Stores the new {@link SceneGeometry} in {@link SceneModel.geometries | SceneModel.geometries}.
   * - Use {@link compressGeometryParams | compressGeometryParams} to pre-compress {@link SceneGeometryParams | SceneGeometryParams}
   *   into {@link SceneGeometryCompressedParams | SceneGeometryCompressedParams}.
   * - Fires {@link SceneEvents.onSceneGeometryCreated | SceneEvents.onSceneGeometryCreated} event.
   *
   * ### Usage
   *
   * ````javascript
   * const boxGeometryResult = sceneModel.createGeometryCompressed({
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
   * if (!boxGeometryResult.ok) {
   *   console.error(boxGeometryResult.error);
   *   return;
   * } else {
   *    const boxGeometry = boxGeometryResult.value;
   * }
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param geometryCompressedParams Pre-compressed geometry parameters.
   *
   * @returns SDKResult with:
   * * On success, the created {@link SceneGeometry}.
   * * On failure, an error message. Reasons for failure include:
   *   - If this SceneModel has already been destroyed.
   *   - Invalid SceneGeometryParams were given.
   *   - SceneGeometry of given ID already exists in this SceneModel.
   *   - Unsupported primitive type given.
   *   - Mandatory vertex positions were not given. Vertex positions are mandatory for all primitive types.
   *   - Mandatory indices were not given for primitive type that is not {@link constants!PointsPrimitive}. Indices are mandatory for all primitive types except PointsPrimitive.
   *   - Indices out of range of vertex positions.
   *   - Indices out of range of vertex UVs.
   *   - Mismatch between given quantities of vertex positions and UVs.
   */
  createGeometryCompressed(
    geometryCompressedParams: SceneGeometryCompressedParams
  ): SDKResult<SceneGeometry> {

    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.createGeometryCompressed] SceneModel already destroyed"
      });
    }

    if (this._finalized) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneModel.createGeometryCompressed] SceneModel already _finalized`
      });
    }

    if (!geometryCompressedParams) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometryCompressed] Parameters expected: geometryCompressedParams"
      });
    }

    const {id, indices, primitive, positionsCompressed, uvsCompressed, normalsCompressed} = geometryCompressedParams;

    if (id === null || id === undefined) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometryCompressed] Parameter expected: 'id'"
      });
    }

    if (!positionsCompressed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometryCompressed] Parameter expected: 'positionsCompressed'"
      });
    }

    if (!indices && primitive !== PointsPrimitive) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createGeometryCompressed] Missing expected 'indices' for the specified primitive type."
      });
    }


    if (uvsCompressed) {
      if (uvsCompressed.length / 2 !== positionsCompressed.length / 3) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: "[SceneModel.createGeometryCompressed] Mismatch between given quantities of vertex positions and UVs"
        });
      }
    }

    if (normalsCompressed) {
      if (normalsCompressed.length / 2 !== positionsCompressed.length / 3) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: "[SceneModel.createGeometryCompressed] Mismatch between given quantities of vertex positions and normals"
        });
      }
    }

    if (indices) {
      const lastPositionsIdx = positionsCompressed.length / 3;
      for (let i = 0, len = indices.length; i < len; i++) {
        const idx = indices[i];
        if (idx < 0 || idx >= lastPositionsIdx) {
          return this.scene.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: "[SceneModel.createGeometryCompressed] Indices out of range of vertex positions"
          });
        }
        if (uvsCompressed) {
          const lastUVsIdx = uvsCompressed.length / 2;
          if (idx < 0 || idx >= lastUVsIdx) {
            return this.scene.logError({
              ok: false,
              type: SDKErrorType.InvalidInput,
              error: "[SceneModel.createGeometryCompressed] Indices out of range of vertex UVs"
            });
          }
        }
      }
    }

    const geometryId = id;
    if (this.geometries[geometryId]) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createGeometryCompressed] SceneGeometry with this ID already exists: '${geometryId}'`
      });
    }

    if (
      primitive !== PointsPrimitive &&
      primitive !== LinesPrimitive &&
      primitive !== TrianglesPrimitive &&
      primitive !== SolidPrimitive &&
      primitive !== SurfacePrimitive
    ) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error:
          `[SceneModel.createGeometryCompressed] Unsupported value for parameter 'primitive': '${primitive}' - ` +
          "supported values are PointsPrimitive, LinesPrimitive, TrianglesPrimitive, SolidPrimitive and SurfacePrimitive"
      });
    }

    const sceneGeometry = new SceneGeometry(this, geometryCompressedParams);
    this.geometries[geometryId] = sceneGeometry;
    this.stats.numGeometries++;


    if (indices) {
      if (sceneGeometry.primitive === TrianglesPrimitive) {
        this.stats.numTriangles += indices.length / 3;
      } else if (sceneGeometry.primitive === LinesPrimitive) {
        this.stats.numLines += indices.length / 2;
      }
    } else if (sceneGeometry.primitive === PointsPrimitive) {
      this.stats.numPoints += positionsCompressed.length / 3;
    }
    this.stats.numVertices += positionsCompressed.length / 3;

    if (this._streamingEnabled) {
      this.scene.events.onSceneGeometryCreated.dispatch(this.scene, sceneGeometry);
    }

    return {
      ok: true,
      value: sceneGeometry
    };
  }

  /**
   * @private
   * Destroys a {@link SceneGeometry} previously created in this model.
   */
  _destroyGeometry(sceneGeometry: SceneGeometry) {
    const geometryId = sceneGeometry.id;
    if (this.destroyed) {
      throw new SDKInternalException(`Cannot destroy SceneGeometry '${geometryId}' - SceneModel already destroyed`);
    }
    if (!this.geometries[geometryId]) {
      throw new SDKInternalException(`Cannot destroy SceneGeometry '${geometryId}' - SceneGeometry not found in SceneModel`);
    }
    if (sceneGeometry.numMeshes > 0) {
      // We catch this gracefully in SceneGeometry.destroy(), but just in case...
      throw new SDKInternalException(`Cannot destroy SceneGeometry '${geometryId}' - SceneGeometry is currently used by at least one SceneMesh, which you need to destroy first`);
    }
    delete this.geometries[geometryId];
    this.stats.numGeometries--;
    if (sceneGeometry.indices) {
      if (sceneGeometry.primitive === TrianglesPrimitive) {
        this.stats.numTriangles -= sceneGeometry.indices.length / 3;
      } else if (sceneGeometry.primitive === LinesPrimitive) {
        this.stats.numLines -= sceneGeometry.indices.length / 2;
      }
    } else if (sceneGeometry.primitive === PointsPrimitive) {
      this.stats.numPoints -= sceneGeometry.positionsCompressed.length / 3;
    }
    this.stats.numVertices -= sceneGeometry.positionsCompressed.length / 3;
    if (this._streamingEnabled) {
      this.scene.events.onSceneGeometryDestroyed.dispatch(this.scene, sceneGeometry);
    }
  }

  /**
   * Creates a new {@link SceneMesh} within this SceneModel.
   *
   * - Stores the new {@link SceneMesh} in {@link SceneModel.meshes | SceneModel.meshes}.
   * - A {@link SceneMesh} can be owned by one {@link SceneObject}, which can own multiple {@link SceneMesh}es.
   * - Increments the {@link SceneGeometry.numMeshes | numMeshes} of the associated {@link SceneGeometry}.
   * - Fires {@link SceneEvents.onSceneMeshCreated | SceneEvents.onSceneMeshCreated} event.
   *
   * ### Usage
   *
   * ````javascript
   * const redBoxMeshResult = sceneModel.createLayerMesh({
   *      id: "redBoxMesh",
   *      geometryId: "boxGeometry",
   *      materialId: "myMaterial",
   *      position: [-4, -6, -4],
   *      scale: [1, 3, 1],
   *      rotation: [0, 0, 0],
   *      color: [1, 0.3, 0.3]
   * });
   *
   * if (!redBoxMeshResult.ok) {
   *   console.error(redBoxMeshResult.error);
   *   return;
   * } else {
   *    const redBoxMesh = redBoxMeshResult.value;
   * }
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param meshParams Pre-compressed mesh parameters.
   * @returns SDKResult with:
   * * On success, the created {@link SceneMesh}.
   * * On failure, an error message. Reasons for failure include:
   *   - If this SceneModel has already been destroyed.
   *   - Invalid {@link SceneMeshParams} were given.
   *   - A {@link SceneMesh} with the given ID already exists in this SceneModel.
   *   - The specified parent {@link SceneTransform} was not found.
   *   - The specified {@link SceneGeometry} was not found.
   *   - The specified {@link SceneMaterial} was not found.
   */
  createMesh(meshParams: SceneMeshParams): SDKResult<SceneMesh> {

    let {
      id,
      geometryId,
      parentTransformId,
      materialId,
      matrix,
      position,
      scale,
      rotation,
      quaternion,
      color,
      opacity
    } = meshParams;

    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.addMesh] SceneModel already destroyed"
      });
    }

    if (this._finalized) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneModel.createMesh] SceneModel already _finalized`
      });
    }

    if (this.meshes[id]) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createMesh] SceneMesh already exists with this ID: '${id}'`
      });
    }

    let transform: SceneTransform | undefined;
    if (parentTransformId) {
      transform = this.transforms[parentTransformId];
      if (!transform) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[SceneModel.createMesh] parent SceneTransform not found: '${parentTransformId}'`
        });
      }
    }

    const geometry = this.geometries[geometryId];
    if (!geometry) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createMesh] SceneGeometry not found: '${geometryId}'`
      });
    }

    const material = materialId ? this.materials[materialId] : undefined;
    if (materialId && !material) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createMesh] Material not found: '${materialId}'`
      });
    }

    // Build matrix (clone if provided; otherwise compose or identity)

    if (!matrix) {
      if (position || scale || rotation || quaternion) {

        if (position && position.length !== 3) {
          return this.scene.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[SceneModel.createMesh] Parameter 'position' is not a vec3 array`
          });
        }

        if (scale && scale.length !== 3) {
          return this.scene.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[SceneModel.createMesh] Parameter 'scale' is not a vec3 array`
          });
        }

        if (rotation && rotation.length !== 3) {
          return this.scene.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[SceneModel.createMesh] Parameter 'rotation' is not a vec3 array`
          });
        }

        if (quaternion && quaternion.length !== 4) {
          return this.scene.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[SceneModel.createMesh] Parameter 'quaternion' is not a vec4 array`
          });
        }

        matrix = identityMat4();

        composeMat4(
          position || [0, 0, 0],
          quaternion || eulerToQuat(rotation || [0, 0, 0], "XYZ", identityQuat()),
          scale || [1, 1, 1],
          matrix
        );
      } else {
        matrix = identityMat4();
      }
    } else {
      if (matrix.length !== 16) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[SceneModel.createMesh] Parameter 'matrix' is not a mat4 array`
        });
      }
      matrix = createMat4Float64(matrix);
    }

    if (color && color.length !== 3) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createMesh] Parameter 'color' is not a vec3 array`
      });
    }

    const sceneMesh = new SceneMesh({
      id,
      model: this,
      geometry,
      material,
      matrix,
      color,
      opacity
    });

    if (transform) {
      sceneMesh.setParentTransformId(transform.id);
    }

    geometry.numMeshes++;
    this.meshes[id] = sceneMesh;
    this.stats.numMeshes++;
    if (this._streamingEnabled) {
      this.scene.events.onSceneMeshCreated.dispatch(this.scene, sceneMesh);
    }

    return {
      ok: true,
      value: sceneMesh
    };
  }

  /**
   * @private
   * Destroys a {@link SceneMesh} previously created in this model.
   * Called by a {@link SceneMesh} when it is destroyed.
   */
  _destroyMesh(sceneMesh: SceneMesh) {
    const meshId = sceneMesh.id;
    if (this.destroyed) {
      throw new SDKInternalException(`Cannot destroy SceneMesh '${meshId}' - SceneModel already destroyed`);
    }
    const existing = this.meshes[meshId];
    if (!existing) {
      throw new SDKInternalException(`Cannot destroy SceneMesh '${meshId}' - SceneMesh not found in SceneModel`);
    }
    // (Optional strengthening) Ensure the passed instance matches the one stored.
    if (existing !== sceneMesh) {
      throw new SDKInternalException(`Cannot destroy SceneMesh '${meshId}' - provided instance does not match stored mesh`);
    }
    if (existing.object) {
      // We catch this gracefully in SceneMesh.destroy(), but just in case...
      throw new SDKInternalException(
        `Cannot destroy SceneMesh '${meshId}' - SceneMesh belongs to SceneObject '${existing.object.id}', which you need to destroy first`
      );
    }
    if (existing.geometry) {
      existing.geometry.numMeshes--;
    }
    delete this.meshes[meshId];
    this.stats.numMeshes--;
    if (this._streamingEnabled) {
      this.scene.events.onSceneMeshDestroyed.dispatch(this.scene, existing);
    }
  }

  /**
   * Creates a new {@link SceneObject}.
   *
   * - Stores the new {@link SceneObject} in {@link SceneModel.objects | SceneModel.objects} and {@link Scene.objects | Scene.objects}.
   * - Each {@link SceneMesh} is allowed to belong to one SceneObject.
   * - SceneObject IDs must be unique within the SceneModel's {@link Scene | Scene}.
   * - Triggers {@link SceneEvents.onSceneObjectCreated | SceneEvents.onSceneObjectCreated}.
   *
   * ### Usage
   *
   * ````javascript
   * const redBoxObjectResult = sceneModel.createObject({
   *     id: "redBoxObject",
   *     meshIds: ["redBoxMesh"]
   * });
   *
   * if (!redBoxObjectResult.ok) {
   *   console.error(redBoxObjectResult.error);
   *   return;
   *   } else {
   *      const redBoxObject = redBoxObjectResult.value;
   *      const redBoxObjectAgain = sceneModel.objects["redBoxObject"];
   *      const redBoxObjectOnceMore = scene.objects["redBoxObject"];
   * }
   * ````
   *
   * See {@link scene | @xeokit/sdk/scene}   for more usage info.
   *
   * @param objectParams SceneObject parameters.
   * @returns SDKResult with:
   * * On success, the created {@link SceneObject}.
   * * On failure, an error message. Reasons for failure include:
   *   - If this SceneModel has already been destroyed.
   *   - No {@link SceneMesh} IDs were specified.
   *   - A {@link SceneObject} with the given ID already exists in this SceneModel's {@link Scene | Scene}.
   *   - A specified {@link SceneMesh} was not found.
   *   - A specified {@link SceneMesh} already belongs to an existing {@link SceneObject}.
   */
  createObject(objectParams: SceneObjectParams): SDKResult<SceneObject> {

    const {
      id,
      meshIds,
      layerId,
      originalSystemId
    } = objectParams;

    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.createObject] SceneModel already destroyed"
      });
    }

    if (this._finalized) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneModel.createObject] SceneModel already _finalized`
      });
    }

    if (!meshIds || meshIds.length === 0) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[SceneModel.createObject] No meshes specified"
      });
    }

    const objectId = this.globalizedIds ? `${this.id}.${id}` : id;
    if (this.scene.objects[objectId]) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneModel.createObject] SceneObject already exists: '${objectId}'`
      });
    }

    const meshes = [];
    for (let meshIdIdx = 0, meshIdLen = meshIds.length; meshIdIdx < meshIdLen; meshIdIdx++) {
      const meshId = meshIds[meshIdIdx];
      const mesh = this.meshes[meshId];
      if (!mesh) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[SceneModel.createObject] SceneMesh not found: '${meshId}'`
        });
      }
      if (mesh.object) {
        return this.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[SceneModel.createObject] SceneMesh '${meshId}' already belongs to existing SceneObject '${mesh.object.id}'`
        });
      }
      meshes.push(mesh);
    }

    const sceneObject = new SceneObject({
      id: objectId,
      originalSystemId: originalSystemId,
      layerId: this.layerId || layerId,
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

    return {
      ok: true,
      value: sceneObject
    };
  }

  /**
   * Marks this transform globally dirty and propagates that state to all descendants.
   * @internal
   */
  public setWorldMatrixDirty(): void {
    for (const id in this.transforms) {
      this.transforms[id].setWorldMatrixDirty();
    }
    for (const id in this.meshes) {
      this.meshes[id].setWorldMatrixDirty();
    }
  }

  /**
   * @private
   * Destroys a {@link SceneObject} previously created in this model.
   * Called by a {@link SceneObject} when it is destroyed.
   */
  _destroyObject(sceneObject: SceneObject) {
    const objectId = sceneObject.id;
    if (this.destroyed) {
      throw new SDKInternalException(`Cannot destroy SceneObject '${objectId}' - SceneModel already destroyed`);
    }
    if (!this.objects[objectId]) {
      throw new SDKInternalException(`Cannot destroy SceneObject '${objectId}' - SceneObject not found in SceneModel`);
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
   * Creates components in this SceneModel from {@link SceneModelParams}.
   *
   * See {@link scene | @xeokit/sdk/scene} for usage.
   *
   * @param sceneModelParams The batch of components to create.
   * @returns SDKResult with:
   * * On success, value==`undefined`.
   * * On failure, an error message.
   */
  fromParams(sceneModelParams: SceneModelParams): SDKResult<any> {

    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.fromParams] SceneModel already destroyed"
      });
    }

    if (this._finalized) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneModel.fromParams] SceneModel already _finalized`
      });
    }

    if (sceneModelParams.coordinateSystem) {
      this.coordinateSystem.fromParams(sceneModelParams.coordinateSystem);
    }

    if (sceneModelParams.transforms) {
      for (let i = 0, len = sceneModelParams.transforms.length; i < len; i++) {
        const res = this.createTransform(sceneModelParams.transforms[i]);
        if (!res.ok) return res;
      }
    }

    if (sceneModelParams.geometries) {
      for (let i = 0, len = sceneModelParams.geometries.length; i < len; i++) {
        const res = this.createGeometry(sceneModelParams.geometries[i]);
        if (!res.ok) return res;
      }
    }

    if (sceneModelParams.geometriesCompressed) {
      for (let i = 0, len = sceneModelParams.geometriesCompressed.length; i < len; i++) {
        const res = this.createGeometryCompressed(sceneModelParams.geometriesCompressed[i]);
        if (!res.ok) return res;
      }
    }

    if (sceneModelParams.textures) {
      for (let i = 0, len = sceneModelParams.textures.length; i < len; i++) {
        const res = this.createTexture(sceneModelParams.textures[i]);
        if (!res.ok) return res;
      }
    }

    if (sceneModelParams.materials) {
      for (let i = 0, len = sceneModelParams.materials.length; i < len; i++) {
        const res = this.createMaterial(sceneModelParams.materials[i]);
        if (!res.ok) return res;
      }
    }

    if (sceneModelParams.meshes) {
      for (let i = 0, len = sceneModelParams.meshes.length; i < len; i++) {
        const res = this.createMesh(sceneModelParams.meshes[i]);
        if (!res.ok) return res;
      }
    }

    if (sceneModelParams.objects) {
      for (let i = 0, len = sceneModelParams.objects.length; i < len; i++) {
        const res = this.createObject(sceneModelParams.objects[i]);
        if (!res.ok) return res;
      }
    }

    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Gets this SceneModel as {@link SceneModelParams}.
   *
   * @remarks
   * Currently serializes: `transforms`, `geometriesCompressed`, `meshes`, and `objects`.
   * (Textures and materials are intentionally omitted/commented.)
   *
   * See {@link scene | @xeokit/sdk/scene} for usage.
   */
  toParams(): SDKResult<SceneModelParams> {
    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.toParams] SceneModel already destroyed"
      });
    }
    const sceneModelParams: SceneModelParams = {
      id: this.id,
      coordinateSystem: this.coordinateSystem.toParams(),
      geometriesCompressed: [],
      textures: [],
      materials: [],
      transforms: [],
      meshes: [],
      objects: []
    };
    // for (const key in this.transforms) {
    //         sceneModelParams.transforms.push(this.transforms[key].toParams());
    // }
    for (const key in this.geometries) {
      const res = this.geometries[key].toParams();
      if (!res.ok) {
        return res;
      }
      sceneModelParams.geometriesCompressed.push(res.value);
    }
    for (const key in this.meshes) {
      const res = this.meshes[key].toParams();
      if (!res.ok) {
        return res;
      }
      sceneModelParams.meshes.push(res.value);
    }
    for (const key in this.objects) {
      const res = this.objects[key].toParams();
      if (!res.ok) {
        return res;
      }
      sceneModelParams.objects.push(res.value);
    }
    for (const key in this.transforms) {
      const res = this.transforms[key].toParams();
      if (!res.ok) {
        return res;
      }
      sceneModelParams.transforms.push(res.value);
    }
    for (const key in this.textures) {
           const res =  this.textures[key].toParams();
           if (!res.ok) {
             return res;
           }
             sceneModelParams.textures.push(res.value);
    }
    for (const key in this.materials) {
      const res =  this.materials[key].toParams();
      if (!res.ok) {
        return res;
      }
      sceneModelParams.materials.push(res.value);
    }
    return {
      ok: true,
      value: sceneModelParams
    };
  }

  /**
   * When in deferred build mode, finalizes this SceneModel, preventing creation of new components within it.
   * Only applies when {@link SceneModel._streamingEnabled | _streamingEnabled} is `false`.
   */
  finalize():SDKResult<any> {
    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.finalize] SceneModel already destroyed"
      });
    }
    if (this._streamingEnabled) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.finalize] SceneModel is streaming-enabled, so cannot be finalized"
      });
    }
    if (this._finalized) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneModel.finalize] SceneModel already finalized`
      });
    }
    // @ts-ignore
    this._finalized = true;
    this.scene.events.onSceneModelFinalized.dispatch(this.scene, this);
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Destroys this SceneModel.
   *
   * - Fires {@link SceneEvents.onSceneModelDestroyed | SceneEvents.onSceneModelDestroyed}.
   * - Removes this SceneModel from its {@link Scene}.
   * - Destroys all components created within this SceneModel.
   */
  destroy(): SDKResult<any> {
    if (this.destroyed) {
      return this.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneModel.destroy] SceneModel already destroyed"
      });
    }
    for (const key in this.objects) {
      this.objects[key].destroy();
    }
    for (const key in this.meshes) {
      this.meshes[key].destroy();
    }
    for (const key in this.transforms) {
      this.transforms[key].destroy();
    }
    for (const key in this.geometries) {
      this.geometries[key].destroy();
    }
    for (const key in this.textures) {
      this.textures[key].destroy();
    }
    for (const key in this.materials) {
       this.materials[key].destroy();
    }
    this.scene._destroyModel(this);
    this.destroyed = true;
    return {
      ok: true,
      value: undefined
    };
  }
}
