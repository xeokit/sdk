import { Scene } from "./Scene";
import { EventEmitter, type SDKResult } from "../../base/core";
import { SceneModel } from "./SceneModel";
import { SceneObject } from "./SceneObject";
import { SceneMesh } from "./SceneMesh";
import { SceneGeometry } from "./SceneGeometry";
import { SceneTransform } from "./SceneTransform";
import { EventDispatcher } from "strongly-typed-events";
import { CoordinateSystem } from "./CoordinateSystem";
import { SceneTexture } from "./SceneTexture";
import { SceneMaterial } from "./SceneMaterial";
import { SceneModelBatch } from "./SceneModelBatch";
import type {SceneRepSet} from "./SceneRepSet";

/**
 * Represents the events emitted by a {@link model!scene.Scene | Scene}.
 *
 * This class provides a collection of event emitters for actions and updates
 * that occur within a {@link model!scene.Scene | Scene} and its owned components, such as models,
 * objects, meshes, geometries, transforms, textures, and coordinate systems.
 */
export class SceneEvents {

  /**
   * Emits an event when an error occurs within the {@link model!scene.Scene | Scene} or any of its child components.
   * This non-fatal event is fired with an `SDKResult` containing error details whenever an operation fails.
   */
  public readonly onError: EventEmitter<Scene, SDKResult<any>>;

  /**
   * Emits an event when the {@link model!scene.Scene | Scene} is destroyed.
   */
  public readonly onSceneDestroyed: EventEmitter<Scene, Scene>;

  /**
   * Emits an event when the {@link CoordinateSystem.basis} of the {@link model!scene.Scene | Scene} is updated.
   */
  public readonly onSceneCoordSystemBasisChanged: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.origin} of the {@link model!scene.Scene | Scene} is updated.
   */
  public readonly onSceneCoordSystemOriginChanged: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.units} of the {@link model!scene.Scene | Scene} is updated.
   */
  public readonly onSceneCoordSystemUnitsChanged: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.scaleToMeters} of the {@link model!scene.Scene | Scene} is updated.
   */
  public readonly onSceneCoordSystemScaleToMetersChanged: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event after one or more coordinate system properties of the {@link model!scene.Scene | Scene} have been updated,
   * indicating that the {@link CoordinateSystem} is ready for use.
   */
  public readonly onSceneCoordSystemUpdated: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event each time a {@link model!scene.SceneModel | SceneModel} is created within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneModelCreated: EventEmitter<Scene, SceneModel>;

  /**
   * Emits an event each time a {@link model!scene.SceneModel | SceneModel} is destroyed within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneModelDestroyed: EventEmitter<Scene, SceneModel>;

  /**
   * Emits an event when a {@link model!scene.SceneModel | SceneModel} enters its "building" state — i.e. a
   * loader has begun populating it. Consumers (e.g. the renderer) can use this to
   * suspend per-frame work until the model is fully assembled. Paired with
   * {@link onSceneModelBuildFinished}.
   */
  public readonly onSceneModelBuildStarted: EventEmitter<Scene, SceneModel>;

  /**
   * Emits an event when a {@link model!scene.SceneModel | SceneModel} leaves its "building" state — the
   * loader has finished (or failed). Always fires to match a preceding
   * {@link onSceneModelBuildStarted}, so consumers can rely on balanced pairs.
   */
  public readonly onSceneModelBuildFinished: EventEmitter<Scene, SceneModel>;

  /**
   * Emits when a {@link model!scene.SceneModel | SceneModel} begins a component
   * creation batch.
   */
  public readonly onSceneModelBatchStarted: EventEmitter<SceneModel, SceneModelBatch>;

  /**
   * Emits when a {@link model!scene.SceneModel | SceneModel} commits a
   * component creation batch.
   */
  public readonly onSceneModelBatchCommitted: EventEmitter<SceneModel, SceneModelBatch>;

  /**
   * Emits when a {@link model!scene.SceneModel | SceneModel} rolls back a
   * component creation batch.
   */
  public readonly onSceneModelBatchRolledBack: EventEmitter<SceneModel, SceneModelBatch>;

  /**
   * Emits when a {@link model!scene.SceneModel | SceneModel} is sealed against
   * further topology/resource growth.
   */
  public readonly onSceneModelSealed: EventEmitter<Scene, SceneModel>;

  /**
   * Emits an event each time a {@link model!scene.SceneRepSet | SceneRepSet} is created within a {@link model!scene.SceneModel | SceneModel}.
   */
  public readonly onSceneRepSetCreated: EventEmitter<SceneModel, SceneRepSet>;

  /**
   * Emits an event each time a {@link model!scene.SceneRepSet | SceneRepSet} is destroyed within a {@link model!scene.SceneModel | SceneModel}.
   */
  public readonly onSceneRepSetDestroyed: EventEmitter<SceneModel, SceneRepSet>;

  /**
   * Emits an event when the {@link CoordinateSystem.basis} of a {@link model!scene.SceneModel | SceneModel} is updated.
   */
  public readonly onSceneModelCoordSystemBasisChanged: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.origin} of a {@link model!scene.SceneModel | SceneModel} is updated.
   */
  public readonly onSceneModelCoordSystemOriginChanged: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.units} of a {@link model!scene.SceneModel | SceneModel} is updated.
   */
  public readonly onSceneModelCoordSystemUnitsChanged: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.scaleToMeters} of a {@link model!scene.SceneModel | SceneModel} is updated.
   */
  public readonly onSceneModelCoordSystemScaleToMetersChanged: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event after one or more coordinate system properties of a {@link model!scene.SceneModel | SceneModel} have been updated,
   * indicating that the {@link CoordinateSystem} is ready for use.
   */
  public readonly onSceneModelCoordSystemUpdated: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event each time a {@link model!scene.SceneObject | SceneObject} is created within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneObjectCreated: EventEmitter<Scene, SceneObject>;

  /**
   * Emits an event each time a {@link model!scene.SceneMesh | SceneMesh} is added to a {@link model!scene.SceneObject | SceneObject}.
   */
  public readonly onSceneObjectMeshAdded: EventEmitter<SceneObject, SceneMesh>;

  /**
   * Emits an event each time a {@link model!scene.SceneMesh | SceneMesh} is removed from a {@link model!scene.SceneObject | SceneObject}.
   */
  public readonly onSceneObjectMeshRemoved: EventEmitter<SceneObject, SceneMesh>;

  /**
   * Emits an event each time a {@link model!scene.SceneObject | SceneObject} is destroyed within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneObjectDestroyed: EventEmitter<Scene, SceneObject>;

  /**
   * Emits an event each time a {@link model!scene.SceneMesh | SceneMesh} is created within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMeshCreated: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link model!scene.SceneMesh | SceneMesh} is destroyed within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMeshDestroyed: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time the transformation matrix of a {@link model!scene.SceneMesh | SceneMesh} is updated within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMeshMatrixChanged: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link model!scene.SceneMesh | SceneMesh} is moved within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMeshMoved: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time the color of a {@link model!scene.SceneMesh | SceneMesh} is updated within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMeshColorChanged: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time the opacity of a {@link model!scene.SceneMesh | SceneMesh} is updated within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMeshOpacityChanged: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link model!scene.SceneGeometry | SceneGeometry} is created within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneGeometryCreated: EventEmitter<Scene, SceneGeometry>;

  /**
   * Emits an event each time a {@link model!scene.SceneGeometry | SceneGeometry} is destroyed within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneGeometryDestroyed: EventEmitter<Scene, SceneGeometry>;

  /**
   * Emits an event each time a {@link model!scene.SceneGeometry | SceneGeometry} is updated within the {@link model!scene.Scene | Scene},
   * such as changes to positions, indices, or primitive types.
   */
  public readonly onSceneGeometryUpdated: EventEmitter<Scene, SceneGeometry>;

  /**
   * Emits an event each time a {@link SceneTransform} is created within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneTransformCreated: EventEmitter<Scene, SceneTransform>;

  /**
   * Emits an event each time a {@link SceneTransform} is destroyed within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneTransformDestroyed: EventEmitter<Scene, SceneTransform>;

  /**
   * Emits an event each time the transformation matrix of a {@link SceneTransform} is updated
   * within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneTransformMatrixChanged: EventEmitter<Scene, SceneTransform>;

  /**
   * Emits an event each time a {@link SceneTexture} is created within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneTextureCreated: EventEmitter<Scene, SceneTexture>;

  /**
   * Emits an event each time a {@link SceneTexture} is destroyed within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneTextureDestroyed: EventEmitter<Scene, SceneTexture>;

  /**
   * Emits an event each time a {@link SceneTexture}'s `imageData` is
   * mutated post-creation. Subscribers (e.g. the renderer's texture
   * atlas) re-upload the texture's pixels to the GPU.
   */
  public readonly onSceneTextureImageDataChanged: EventEmitter<Scene, SceneTexture>;

  /**
   * Emits an event each time a {@link model!scene.SceneMaterial | SceneMaterial} is created within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMaterialCreated: EventEmitter<Scene, SceneMaterial>;

  /**
   * Emits an event each time the color of a {@link model!scene.SceneMaterial | SceneMaterial} is updated within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMaterialColorChanged: EventEmitter<Scene, SceneMaterial>;

  /**
   * Emits an event each time the emissive color of a {@link model!scene.SceneMaterial | SceneMaterial} is updated within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMaterialEmissiveColorChanged: EventEmitter<Scene, SceneMaterial>;

  /**
   * Emits an event each time the opacity of a {@link model!scene.SceneMaterial | SceneMaterial} is updated within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMaterialOpacityChanged: EventEmitter<Scene, SceneMaterial>;

  /**
   * Emits an event each time the {@link SceneMaterial.linePattern}
   * or {@link SceneMaterial.hatchPattern} of a {@link model!scene.SceneMaterial | SceneMaterial}
   * is updated within the {@link model!scene.Scene | Scene}. Downstream consumers
   * re-encode the affected pattern slot in their per-batch
   * pattern tables.
   */
  public readonly onSceneMaterialPatternChanged: EventEmitter<Scene, SceneMaterial>;

  /**
   * Emits an event each time a {@link model!scene.SceneMaterial | SceneMaterial} is destroyed within the {@link model!scene.Scene | Scene}.
   */
  public readonly onSceneMaterialDestroyed: EventEmitter<Scene, SceneMaterial>;

  /**
   * @private
   */
  constructor() {
    this.onError = new EventEmitter(new EventDispatcher<Scene, SDKResult<any>>());
    this.onSceneDestroyed = new EventEmitter(new EventDispatcher<Scene, Scene>());
    this.onSceneCoordSystemBasisChanged = new EventEmitter(new EventDispatcher<Scene, CoordinateSystem>());
    this.onSceneCoordSystemOriginChanged = new EventEmitter(new EventDispatcher<Scene, CoordinateSystem>());
    this.onSceneCoordSystemUnitsChanged = new EventEmitter(new EventDispatcher<Scene, CoordinateSystem>());
    this.onSceneCoordSystemScaleToMetersChanged = new EventEmitter(new EventDispatcher<Scene, CoordinateSystem>());
    this.onSceneCoordSystemUpdated = new EventEmitter(new EventDispatcher<Scene, CoordinateSystem>());
    this.onSceneModelCreated = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    this.onSceneModelDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    this.onSceneModelBuildStarted = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    this.onSceneModelBuildFinished = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    this.onSceneModelBatchStarted = new EventEmitter(new EventDispatcher<SceneModel, SceneModelBatch>());
    this.onSceneModelBatchCommitted = new EventEmitter(new EventDispatcher<SceneModel, SceneModelBatch>());
    this.onSceneModelBatchRolledBack = new EventEmitter(new EventDispatcher<SceneModel, SceneModelBatch>());
    this.onSceneModelSealed = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    this.onSceneRepSetCreated = new EventEmitter(new EventDispatcher<SceneModel, SceneRepSet>());
    this.onSceneRepSetDestroyed = new EventEmitter(new EventDispatcher<SceneModel, SceneRepSet>());
    this.onSceneModelCoordSystemBasisChanged = new EventEmitter(new EventDispatcher<SceneModel, CoordinateSystem>());
    this.onSceneModelCoordSystemOriginChanged = new EventEmitter(new EventDispatcher<SceneModel, CoordinateSystem>());
    this.onSceneModelCoordSystemUnitsChanged = new EventEmitter(new EventDispatcher<SceneModel, CoordinateSystem>());
    this.onSceneModelCoordSystemScaleToMetersChanged = new EventEmitter(new EventDispatcher<SceneModel, CoordinateSystem>());
    this.onSceneModelCoordSystemUpdated = new EventEmitter(new EventDispatcher<SceneModel, CoordinateSystem>());
    this.onSceneObjectCreated = new EventEmitter(new EventDispatcher<Scene, SceneObject>());
    this.onSceneObjectMeshAdded = new EventEmitter(new EventDispatcher<SceneObject, SceneMesh>());
    this.onSceneObjectMeshRemoved = new EventEmitter(new EventDispatcher<SceneObject, SceneMesh>());
    this.onSceneObjectDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneObject>());
    this.onSceneMeshCreated = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneMeshDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneMeshMatrixChanged = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneMeshMoved = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneMeshColorChanged = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneMeshOpacityChanged = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneTextureCreated = new EventEmitter(new EventDispatcher<Scene, SceneTexture>());
    this.onSceneTextureDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneTexture>());
    this.onSceneTextureImageDataChanged = new EventEmitter(new EventDispatcher<Scene, SceneTexture>());
    this.onSceneMaterialCreated = new EventEmitter(new EventDispatcher<Scene, SceneMaterial>());
    this.onSceneMaterialColorChanged = new EventEmitter(new EventDispatcher<Scene, SceneMaterial>());
    this.onSceneMaterialEmissiveColorChanged = new EventEmitter(new EventDispatcher<Scene, SceneMaterial>());
    this.onSceneMaterialOpacityChanged = new EventEmitter(new EventDispatcher<Scene, SceneMaterial>());
    this.onSceneMaterialPatternChanged = new EventEmitter(new EventDispatcher<Scene, SceneMaterial>());
    this.onSceneMaterialDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneMaterial>());
    this.onSceneGeometryCreated = new EventEmitter(new EventDispatcher<Scene, SceneGeometry>());
    this.onSceneGeometryDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneGeometry>());
    this.onSceneGeometryUpdated = new EventEmitter(new EventDispatcher<Scene, SceneGeometry>());
    this.onSceneTransformCreated = new EventEmitter(new EventDispatcher<Scene, SceneTransform>());
    this.onSceneTransformDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneTransform>());
    this.onSceneTransformMatrixChanged = new EventEmitter(new EventDispatcher<Scene, SceneTransform>());
  }

  /**
   * @private
   */
  destroy() {
    this.onError.clear();
    this.onSceneDestroyed.clear();
    this.onSceneCoordSystemBasisChanged.clear();
    this.onSceneCoordSystemOriginChanged.clear();
    this.onSceneCoordSystemUnitsChanged.clear();
    this.onSceneCoordSystemScaleToMetersChanged.clear();
    this.onSceneCoordSystemUpdated.clear();
    this.onSceneModelCreated.clear();
    this.onSceneModelDestroyed.clear();
    this.onSceneModelBuildStarted.clear();
    this.onSceneModelBuildFinished.clear();
    this.onSceneModelBatchStarted.clear();
    this.onSceneModelBatchCommitted.clear();
    this.onSceneModelBatchRolledBack.clear();
    this.onSceneModelSealed.clear();
    this.onSceneRepSetCreated.clear();
    this.onSceneRepSetDestroyed.clear();
    this.onSceneModelCoordSystemBasisChanged.clear();
    this.onSceneModelCoordSystemOriginChanged.clear();
    this.onSceneModelCoordSystemUnitsChanged.clear();
    this.onSceneModelCoordSystemScaleToMetersChanged.clear();
    this.onSceneModelCoordSystemUpdated.clear();
    this.onSceneObjectCreated.clear();
    this.onSceneObjectMeshAdded.clear();
    this.onSceneObjectMeshRemoved.clear();
    this.onSceneMeshMoved.clear();
    this.onSceneMeshColorChanged.clear();
    this.onSceneMeshMatrixChanged.clear();
    this.onSceneMeshOpacityChanged.clear();
    this.onSceneTextureCreated.clear();
    this.onSceneTextureDestroyed.clear();
    this.onSceneTextureImageDataChanged.clear();
    this.onSceneMaterialCreated.clear();
    this.onSceneMaterialColorChanged.clear();
    this.onSceneMaterialEmissiveColorChanged.clear();
    this.onSceneMaterialOpacityChanged.clear();
    this.onSceneMaterialPatternChanged.clear();
    this.onSceneMaterialDestroyed.clear();
    this.onSceneGeometryUpdated.clear();
    this.onSceneObjectDestroyed.clear();
    this.onSceneGeometryCreated.clear();
    this.onSceneGeometryDestroyed.clear();
    this.onSceneMeshCreated.clear();
    this.onSceneMeshDestroyed.clear();
    this.onSceneTransformCreated.clear();
    this.onSceneTransformMatrixChanged.clear();
    this.onSceneTransformDestroyed.clear();
  }
}
