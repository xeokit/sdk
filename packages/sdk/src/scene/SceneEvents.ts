import {Scene} from "./Scene";
import {EventEmitter, type SDKResult} from "../core";
import {SceneModel} from "./SceneModel";
import {SceneObject} from "./SceneObject";
import {SceneMesh} from "./SceneMesh";
import {SceneGeometry} from "./SceneGeometry";
import {SceneTransform} from "./SceneTransform";
import {EventDispatcher} from "strongly-typed-events";
import {CoordinateSystem} from "./CoordinateSystem";
import {SceneTexture} from "./SceneTexture";
import {SceneTextureSet} from "./SceneTextureSet";

/**
 * Represents the events emitted by a {@link Scene}.
 *
 * This class provides a collection of event emitters for various actions and updates
 * that occur within a `Scene`, such as the creation or destruction of models, objects,
 * meshes, and transformations, as well as updates to the coordinate system.
 */
export class SceneEvents {

    /**
     * Emits an event when an error occurs within the `Scene` or its components. This non-fatal event
     * is fired with an `SDKResult` containing error details whenever any operation fails.
     */
    public readonly onError: EventEmitter<Scene, SDKResult<any>>;

    /**
     * Emits an event when the `Scene` itself is destroyed.
     */
    public readonly onSceneDestroyed: EventEmitter<Scene, Scene>;

    /**
     * Emits an event when the {@link CoordinateSystem.basis | CoordinateSystem.basis} of the `Scene` is updated.
     */
    public readonly onSceneCoordSystemBasisChanged: EventEmitter<Scene, CoordinateSystem>;

    /**
     * Emits an event when the {@link CoordinateSystem.origin | CoordinateSystem.origin} of the `Scene` is updated.
     */
    public readonly onSceneCoordSystemOriginChanged: EventEmitter<Scene, CoordinateSystem>;

    /**
     * Emits an event when the {@link CoordinateSystem.units | CoordinateSystem.units} of the `Scene` is updated.
     */
    public readonly onSceneCoordSystemUnitsChanged: EventEmitter<Scene, CoordinateSystem>;

    /**
     * Emits an event when the {@link CoordinateSystem.scaleToMeters | CoordinateSystem.scaleToMeters} of the `Scene` is updated.
     */
    public readonly onSceneCoordSystemScaleToMetersChanged: EventEmitter<Scene, CoordinateSystem>;

    /**
     * Emits an event after one or more coordinate system properties have been updated,
     * indicating that the {@link CoordinateSystem} is ready for use.
     */
    public readonly onSceneCoordSystemUpdated: EventEmitter<Scene, CoordinateSystem>;

    /**
     * Emits an event when a {@link SceneModel} is created in the `Scene`.
     */
    public readonly onSceneModelCreated: EventEmitter<Scene, SceneModel>;

    /**
     * Emits an event when a {@link SceneModel} is destroyed in the `Scene`.
     */
    public readonly onSceneModelDestroyed: EventEmitter<Scene, SceneModel>;

    /**
     * Emits an event when the {@link CoordinateSystem.basis | CoordinateSystem.basis} of a {@link SceneModel} is updated.
     */
    public readonly onSceneModelCoordSystemBasisChanged: EventEmitter<SceneModel, CoordinateSystem>;

    /**
     * Emits an event when the {@link CoordinateSystem.origin | CoordinateSystem.origin} of a {@link SceneModel} is updated.
     */
    public readonly onSceneModelCoordSystemOriginChanged: EventEmitter<SceneModel, CoordinateSystem>;

    /**
     * Emits an event when the {@link CoordinateSystem.units | CoordinateSystem.units} of a {@link SceneModel} is updated.
     */
    public readonly onSceneModelCoordSystemUnitsChanged: EventEmitter<SceneModel, CoordinateSystem>;

    /**
     * Emits an event when the {@link CoordinateSystem.scaleToMeters | CoordinateSystem.scaleToMeters} of a {@link SceneModel} is updated.
     */
    public readonly onSceneModelCoordSystemScaleToMetersChanged: EventEmitter<SceneModel, CoordinateSystem>;

    /**
     * Emits an event after one or more coordinate system properties of a {@link SceneModel} have been updated,
     * indicating that the {@link CoordinateSystem} is ready for use.
     */
    public readonly onSceneModelCoordSystemUpdated: EventEmitter<SceneModel, CoordinateSystem>;

    /**
     * Emits an event when a {@link SceneObject} is created in the `Scene`.
     */
    public readonly onSceneObjectCreated: EventEmitter<Scene, SceneObject>;

    /**
     * Emits an event when a {@link SceneMesh} is added to a {@link SceneObject}.
     */
    public readonly onSceneObjectMeshAdded: EventEmitter<SceneObject, SceneMesh>;

    /**
     * Emits an event when a {@link SceneMesh} is removed from a {@link SceneObject}.
     */
    public readonly onSceneObjectMeshRemoved: EventEmitter<SceneObject, SceneMesh>;

    /**
     * Emits an event when a {@link SceneObject} is destroyed in the `Scene`.
     */
    public readonly onSceneObjectDestroyed: EventEmitter<Scene, SceneObject>;

    /**
     * Emits an event when a {@link SceneMesh} is created in the `Scene`.
     */
    public readonly onSceneMeshCreated: EventEmitter<Scene, SceneMesh>;

    /**
     * Emits an event when a {@link SceneMesh} is destroyed in the `Scene`.
     */
    public readonly onSceneMeshDestroyed: EventEmitter<Scene, SceneMesh>;

    /**
     * Emits an event when the transformation matrix of a {@link SceneMesh} is updated.
     */
    public readonly onSceneMeshMatrixChanged: EventEmitter<Scene, SceneMesh>;

    /**
     * Emits an event when a {@link SceneMesh} is moved.
     */
    public readonly onSceneMeshMoved: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event when a {@link SceneMesh} switches to a different {@link SceneGeometry}.
   */
  public readonly onSceneMeshGeometryChanged: EventEmitter<Scene, SceneMesh>;

    /**
     * Emits an event when the color of a {@link SceneMesh} is updated.
     */
    public readonly onSceneMeshColorChanged: EventEmitter<Scene, SceneMesh>;

    /**
     * Emits an event when the opacity of a {@link SceneMesh} is updated.
     */
    public readonly onSceneMeshOpacityChanged: EventEmitter<Scene, SceneMesh>;

    /**
     * Emits an event when a {@link SceneGeometry} is created in the `Scene`.
     */
    public readonly onSceneGeometryCreated: EventEmitter<Scene, SceneGeometry>;

    /**
     * Emits an event when a {@link SceneGeometry} is destroyed in the `Scene`.
     */
    public readonly onSceneGeometryDestroyed: EventEmitter<Scene, SceneGeometry>;

    /**
     * Emits an event when a {@link SceneGeometry} is updated, such as changes to positions, indices, or primitive types.
     */
    public readonly onSceneGeometryUpdated: EventEmitter<Scene, SceneGeometry>;

    /**
     * Emits an event when a {@link SceneTransform} is created in the `Scene`.
     */
    public readonly onSceneTransformCreated: EventEmitter<Scene, SceneTransform>;

    /**
     * Emits an event when a {@link SceneTransform} is destroyed in the `Scene`.
     */
    public readonly onSceneTransformDestroyed: EventEmitter<Scene, SceneTransform>;

    /**
     * Emits an event when the transformation matrix of a {@link SceneTransform} is updated.
     */
    public readonly onSceneTransformMatrixChanged: EventEmitter<Scene, SceneTransform>;

    /**
     * Emits an event when a {@link SceneTexture} is created in the `Scene`.
     */
    public readonly onSceneTextureCreated: EventEmitter<Scene, SceneTexture>;

    /**
     * Emits an event when a {@link SceneTexture} is destroyed in the `Scene`.
     */
    public readonly onSceneTextureDestroyed: EventEmitter<Scene, SceneTexture>;

    /**
     * Emits an event when a {@link SceneTextureSet} is created in the `Scene`.
     */
    public readonly onSceneTextureSetCreated: EventEmitter<Scene, SceneTextureSet>;

    /**
     * Emits an event when a {@link SceneTextureSet} is destroyed in the `Scene`.
     */
    public readonly onSceneTextureSetDestroyed: EventEmitter<Scene, SceneTextureSet>;

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
        this.onSceneMeshColorChanged = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
        this.onSceneMeshOpacityChanged = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
        this.onSceneTextureCreated = new EventEmitter(new EventDispatcher<Scene, SceneTexture>());
        this.onSceneTextureDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneTexture>());
        this.onSceneTextureSetCreated = new EventEmitter(new EventDispatcher<Scene, SceneTextureSet>());
        this.onSceneTextureSetDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneTextureSet>());
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
        this.onSceneMeshColorChanged.clear()
        this.onSceneMeshMatrixChanged.clear();
        this.onSceneMeshOpacityChanged.clear();
        this.onSceneTextureCreated.clear();
        this.onSceneTextureDestroyed.clear();
        this.onSceneTextureSetCreated.clear();
        this.onSceneTextureSetDestroyed.clear();
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
