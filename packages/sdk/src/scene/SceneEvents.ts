import { Scene } from "./Scene";
import { EventEmitter, type SDKResult } from "../core";
import { SceneModel } from "./SceneModel";
import { SceneObject } from "./SceneObject";
import { SceneMesh } from "./SceneMesh";
import { SceneGeometry } from "./SceneGeometry";
import { SceneTransform } from "./SceneTransform";
import { EventDispatcher } from "strongly-typed-events";
import { CoordinateSystem } from "./CoordinateSystem";
import { SceneTexture } from "./SceneTexture";
import { SceneMaterial } from "./SceneMaterial";

/**
 * Represents the events emitted by a {@link Scene}.
 *
 * This class provides a collection of event emitters for actions and updates
 * that occur within a {@link Scene} and its owned components, such as models,
 * objects, meshes, geometries, transforms, textures, and coordinate systems.
 */
export class SceneEvents {

  /**
   * Emits an event when an error occurs within the {@link Scene} or any of its child components.
   * This non-fatal event is fired with an `SDKResult` containing error details whenever an operation fails.
   */
  public readonly onError: EventEmitter<Scene, SDKResult<any>>;

  /**
   * Emits an event when the {@link Scene} is destroyed.
   */
  public readonly onSceneDestroyed: EventEmitter<Scene, Scene>;

  /**
   * Emits an event when the {@link CoordinateSystem.basis} of the {@link Scene} is updated.
   */
  public readonly onSceneCoordSystemBasisChanged: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.origin} of the {@link Scene} is updated.
   */
  public readonly onSceneCoordSystemOriginChanged: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.units} of the {@link Scene} is updated.
   */
  public readonly onSceneCoordSystemUnitsChanged: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.scaleToMeters} of the {@link Scene} is updated.
   */
  public readonly onSceneCoordSystemScaleToMetersChanged: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event after one or more coordinate system properties of the {@link Scene} have been updated,
   * indicating that the {@link CoordinateSystem} is ready for use.
   */
  public readonly onSceneCoordSystemUpdated: EventEmitter<Scene, CoordinateSystem>;

  /**
   * Emits an event each time a {@link SceneModel} is created within the {@link Scene}.
   */
  public readonly onSceneModelCreated: EventEmitter<Scene, SceneModel>;

  /**
   * For each {@link SceneModel} with  {@link SceneModel.streamingEnabled | SceneModel.streamingEnabled} is enabled, emits an
   * event each time the SceneModel is finalized within the {@link Scene}, indicating that the model is
   * fully populated and ready for use.
   */
  public readonly onSceneModelFinalized: EventEmitter<Scene, SceneModel>;

  /**
   * Emits an event each time a {@link SceneModel} is destroyed within the {@link Scene}.
   */
  public readonly onSceneModelDestroyed: EventEmitter<Scene, SceneModel>;

  /**
   * Emits an event when the {@link CoordinateSystem.basis} of a {@link SceneModel} is updated.
   */
  public readonly onSceneModelCoordSystemBasisChanged: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.origin} of a {@link SceneModel} is updated.
   */
  public readonly onSceneModelCoordSystemOriginChanged: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.units} of a {@link SceneModel} is updated.
   */
  public readonly onSceneModelCoordSystemUnitsChanged: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event when the {@link CoordinateSystem.scaleToMeters} of a {@link SceneModel} is updated.
   */
  public readonly onSceneModelCoordSystemScaleToMetersChanged: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event after one or more coordinate system properties of a {@link SceneModel} have been updated,
   * indicating that the {@link CoordinateSystem} is ready for use.
   */
  public readonly onSceneModelCoordSystemUpdated: EventEmitter<SceneModel, CoordinateSystem>;

  /**
   * Emits an event each time a {@link SceneObject} is created within the {@link Scene}.
   */
  public readonly onSceneObjectCreated: EventEmitter<Scene, SceneObject>;

  /**
   * Emits an event each time a {@link SceneMesh} is added to a {@link SceneObject}.
   */
  public readonly onSceneObjectMeshAdded: EventEmitter<SceneObject, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneMesh} is removed from a {@link SceneObject}.
   */
  public readonly onSceneObjectMeshRemoved: EventEmitter<SceneObject, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneObject} is destroyed within the {@link Scene}.
   */
  public readonly onSceneObjectDestroyed: EventEmitter<Scene, SceneObject>;

  /**
   * Emits an event each time a {@link SceneMesh} is created within the {@link Scene}.
   */
  public readonly onSceneMeshCreated: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneMesh} is destroyed within the {@link Scene}.
   */
  public readonly onSceneMeshDestroyed: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time the transformation matrix of a {@link SceneMesh} is updated within the {@link Scene}.
   */
  public readonly onSceneMeshMatrixChanged: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneMesh} is moved within the {@link Scene}.
   */
  public readonly onSceneMeshMoved: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneMesh} switches to a different {@link SceneGeometry}
   * within the {@link Scene}.
   */
  public readonly onSceneMeshGeometryChanged: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneMesh} switches to a different {@link SceneMaterial}
   * within the {@link Scene}.
   */
  public readonly onSceneMeshMaterialChanged: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time the color of a {@link SceneMesh} is updated within the {@link Scene}.
   */
  public readonly onSceneMeshColorChanged: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time the opacity of a {@link SceneMesh} is updated within the {@link Scene}.
   */
  public readonly onSceneMeshOpacityChanged: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneGeometry} is created within the {@link Scene}.
   */
  public readonly onSceneGeometryCreated: EventEmitter<Scene, SceneGeometry>;

  /**
   * Emits an event each time a {@link SceneGeometry} is destroyed within the {@link Scene}.
   */
  public readonly onSceneGeometryDestroyed: EventEmitter<Scene, SceneGeometry>;

  /**
   * Emits an event each time a {@link SceneGeometry} is updated within the {@link Scene},
   * such as changes to positions, indices, or primitive types.
   */
  public readonly onSceneGeometryUpdated: EventEmitter<Scene, SceneGeometry>;

  /**
   * Emits an event each time a {@link SceneTransform} is created within the {@link Scene}.
   */
  public readonly onSceneTransformCreated: EventEmitter<Scene, SceneTransform>;

  /**
   * Emits an event each time a {@link SceneTransform} is destroyed within the {@link Scene}.
   */
  public readonly onSceneTransformDestroyed: EventEmitter<Scene, SceneTransform>;

  /**
   * Emits an event each time the transformation matrix of a {@link SceneTransform} is updated
   * within the {@link Scene}.
   */
  public readonly onSceneTransformMatrixChanged: EventEmitter<Scene, SceneTransform>;

  /**
   * Emits an event each time a {@link SceneTexture} is created within the {@link Scene}.
   */
  public readonly onSceneTextureCreated: EventEmitter<Scene, SceneTexture>;

  /**
   * Emits an event each time a {@link SceneTexture} is destroyed within the {@link Scene}.
   */
  public readonly onSceneTextureDestroyed: EventEmitter<Scene, SceneTexture>;

  /**
   * Emits an event each time a {@link SceneMaterial} is created within the {@link Scene}.
   */
  public readonly onSceneMaterialCreated: EventEmitter<Scene, SceneMaterial>;

  /**
   * Emits an event each time the color of a {@link SceneMaterial} is updated within the {@link Scene}.
   */
  public readonly onSceneMaterialColorChanged: EventEmitter<Scene, SceneMaterial>;

  /**
   * Emits an event each time the opacity of a {@link SceneMaterial} is updated within the {@link Scene}.
   */
  public readonly onSceneMaterialOpacityChanged: EventEmitter<Scene, SceneMaterial>;

  /**
   * Emits an event each time a {@link SceneMaterial} is destroyed within the {@link Scene}.
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
    this.onSceneModelFinalized = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    this.onSceneModelDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
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
    this.onSceneMeshGeometryChanged = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneMeshMaterialChanged = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneMeshColorChanged = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneMeshOpacityChanged = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onSceneTextureCreated = new EventEmitter(new EventDispatcher<Scene, SceneTexture>());
    this.onSceneTextureDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneTexture>());
    this.onSceneMaterialCreated = new EventEmitter(new EventDispatcher<Scene, SceneMaterial>());
    this.onSceneMaterialColorChanged = new EventEmitter(new EventDispatcher<Scene, SceneMaterial>());
    this.onSceneMaterialOpacityChanged = new EventEmitter(new EventDispatcher<Scene, SceneMaterial>());
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
    this.onSceneModelFinalized.clear();
    this.onSceneModelDestroyed.clear();
    this.onSceneModelCoordSystemBasisChanged.clear();
    this.onSceneModelCoordSystemOriginChanged.clear();
    this.onSceneModelCoordSystemUnitsChanged.clear();
    this.onSceneModelCoordSystemScaleToMetersChanged.clear();
    this.onSceneModelCoordSystemUpdated.clear();
    this.onSceneObjectCreated.clear();
    this.onSceneObjectMeshAdded.clear();
    this.onSceneObjectMeshRemoved.clear();
    this.onSceneMeshMoved.clear();
    this.onSceneMeshGeometryChanged.clear();
    this.onSceneMeshMaterialChanged.clear();
    this.onSceneMeshColorChanged.clear();
    this.onSceneMeshMatrixChanged.clear();
    this.onSceneMeshOpacityChanged.clear();
    this.onSceneTextureCreated.clear();
    this.onSceneTextureDestroyed.clear();
    this.onSceneMaterialCreated.clear();
    this.onSceneMaterialColorChanged.clear();
    this.onSceneMaterialOpacityChanged.clear();
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

