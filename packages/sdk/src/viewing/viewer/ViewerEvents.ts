import type { Viewer } from "./Viewer";
import { EventEmitter, type SDKResult } from "../../base/core";
import { type TickParams } from "./TickParams";
import type { SnapshotFinishedEvent, SnapshotStartedEvent, View } from "./View";
import type { IntArrayParam } from "../../base/math";
import type { Vec3 } from "../../base/math/vector";
import type { ViewObject } from "./ViewObject";
import type { ViewLayer } from "./ViewLayer";
import type { SectionPlane } from "./SectionPlane";
import type { Frustum3 } from "../../base/math/boundaries";
import type { Camera } from "./Camera";
import { EventDispatcher } from "strongly-typed-events";
import type { Spinner } from "./Spinner";
import type { Scene } from "../../model/scene";
import {ViewTransform} from "./ViewTransform";
import {Effect} from "./Effect";

/**
 * Events emitted by a {@link viewing!viewer.Viewer | Viewer}.
 */
export class ViewerEvents {

  //---------------------------- Viewer Events ----------------------------//

  /**
   * Emits an event when an error occurs within the {@link viewing!viewer.Viewer | Viewer} or any of its child components.
   * This non-fatal event is fired with an `SDKResult` containing error details whenever any operation fails.
   */
  public readonly onError: EventEmitter<Viewer, SDKResult<any>>;

  /**
   * Emits an event each time a {@link model!scene.Scene | Scene} is attached to the {@link viewing!viewer.Viewer | Viewer}.
   */
  readonly onSceneAttached: EventEmitter<Viewer, Scene>;

  /**
   * Emits an event each time a {@link model!scene.Scene | Scene} is detached from the {@link viewing!viewer.Viewer | Viewer}.
   */
  readonly onSceneDetached: EventEmitter<Viewer, Scene>;

  /**
   * Emits an event when the {@link viewing!viewer.Viewer | Viewer} is destroyed.
   */
  readonly onViewerDestroyed: EventEmitter<Viewer, boolean>;

  /**
   * Emits an event each time the {@link viewing!viewer.Viewer | Viewer} "ticks" (~10–60 times per second).
   */
  readonly onTick: EventEmitter<Viewer, TickParams>;

  /**
   * Emits an event each time a message is logged by the {@link viewing!viewer.Viewer | Viewer}.
   */
  readonly log: EventEmitter<Viewer, string>;

  //---------------------------- Effect Events ----------------------------//

  /**
   * Emits an event each time an {@link Effect} is created within the {@link viewing!viewer.Viewer | Viewer}.
   */
  readonly onEffectCreated: EventEmitter<Viewer, Effect>;

  /**
   * Emits an event each time a {@link Effect} is destroyed within the {@link viewing!viewer.Viewer | Viewer}.
   */
  readonly onEffectDestroyed: EventEmitter<Viewer, Effect>;

  //---------------------------- View Events ----------------------------//

  /**
   * Emits an event each time a {@link viewing!viewer.View | View} is created within the {@link viewing!viewer.Viewer | Viewer}.
   */
  readonly onViewCreated: EventEmitter<Viewer, View>;

  /**
   * Emits an event each time a {@link viewing!viewer.View | View} is destroyed within the {@link viewing!viewer.Viewer | Viewer}.
   */
  readonly onViewDestroyed: EventEmitter<Viewer, View>;

  /**
   * Emits an event each time the canvas boundary changes within a {@link viewing!viewer.View | View}.
   */
  readonly onViewCanvasBoundaryChanged: EventEmitter<View, IntArrayParam>;

  //---------------------------- ViewObject Events ----------------------------//

  /**
   * Emits an event each time a {@link viewing!viewer.ViewObject | ViewObject} is created within a {@link viewing!viewer.View | View}.
   */
  readonly onViewObjectCreated: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time a {@link viewing!viewer.ViewObject | ViewObject} is destroyed within a {@link viewing!viewer.View | View}.
   */
  readonly onViewObjectDestroyed: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the visibility of a {@link viewing!viewer.ViewObject | ViewObject} changes within a {@link viewing!viewer.View | View}.
   *
   * ViewObjects are shown and hidden with {@link View.setObjectsVisible},
   * {@link ViewLayer.setObjectsVisible} or {@link ViewObject.visible}.
   */
  readonly onViewObjectVisibleChanged: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the selected state of a {@link viewing!viewer.ViewObject | ViewObject} changes within a {@link viewing!viewer.View | View}.
   *
   * ViewObjects are selected with {@link View.setObjectsSelected},
   * {@link ViewLayer.setObjectsSelected} or {@link ViewObject.selected}.
   */
  readonly onViewObjectSelectedChanged: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the highlight state of a {@link viewing!viewer.ViewObject | ViewObject} changes within a {@link viewing!viewer.View | View}.
   *
   * ViewObjects are highlighted with {@link View.setObjectsHighlighted},
   * {@link ViewLayer.setObjectsHighlighted} or {@link ViewObject.highlighted}.
   */
  readonly onViewObjectHighlightedChanged: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the X-ray state of a {@link viewing!viewer.ViewObject | ViewObject} changes within a {@link viewing!viewer.View | View}.
   *
   * ViewObjects are X-rayed with {@link View.setObjectsXRayed},
   * {@link ViewLayer.setObjectsXRayed} or {@link ViewObject.xrayed}.
   */
  readonly onViewObjectXRayedChanged: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the clippable state of a
   * {@link viewing!viewer.ViewObject | ViewObject} changes within a {@link viewing!viewer.View | View}.
   *
   * ViewObjects are toggled with
   * {@link View.setObjectsClippable},
   * {@link ViewLayer.setObjectsClippable} or
   * {@link ViewObject.clippable}. The renderer subscribes to
   * this to re-encode the per-mesh clippable bit in the
   * MeshViewAttributeTexture so the fragment shader's
   * section-plane test honours the new state on the next
   * frame.
   */
  readonly onViewObjectClippableChanged: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the culled state of a {@link viewing!viewer.ViewObject | ViewObject}
   * changes within a {@link viewing!viewer.View | View}, via
   * {@link ViewObject.culled}. The renderer subscribes to this to drop
   * or restore the object's meshes in that view's GPU draw index.
   */
  readonly onViewObjectCulledChanged: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the colorization of a {@link viewing!viewer.ViewObject | ViewObject} changes within a {@link viewing!viewer.View | View}.
   *
   * ViewObjects are colorized with {@link View.setObjectsColorized},
   * {@link ViewLayer.setObjectsColorized} or {@link ViewObject.colorize}.
   */
  readonly onViewObjectColorizeChanged: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the opacity of a {@link viewing!viewer.ViewObject | ViewObject} changes within a {@link viewing!viewer.View | View}.
   *
   * ViewObjects have their opacity changed with {@link View.setObjectsOpacity},
   * {@link ViewLayer.setObjectsOpacity} or {@link ViewObject.opacity}.
   */
  readonly onViewObjectOpacityChanged: EventEmitter<View, ViewObject>;

  /**
   * Emits an event each time the pickable state of a {@link viewing!viewer.ViewObject | ViewObject} changes within a {@link viewing!viewer.View | View}.
   *
   * ViewObjects have their pickable state changed with {@link View.setObjectsPickable},
   * {@link ViewLayer.setObjectsPickable} or {@link ViewObject.pickable}.
   */
  readonly onViewObjectPickableChanged: EventEmitter<View, ViewObject>;

  //---------------------------- ViewLayer Events ----------------------------//

  /**
   * Emits an event each time a {@link ViewLayer} is created within a {@link viewing!viewer.View | View}.
   *
   * Layers are created explicitly with {@link View.createLayer}, or implicitly with
   * {@link model!scene.SceneModel.createObject | SceneModel.createObject} and
   * {@link model!scene.SceneObjectParams.layerId | SceneObjectParams.layerId}.
   */
  readonly onViewLayerCreated: EventEmitter<View, ViewLayer>;

  /**
   * Emits an event each time a {@link ViewLayer} is destroyed within a {@link viewing!viewer.View | View}.
   *
   * ViewLayers are destroyed explicitly with {@link ViewLayer.destroy}, or implicitly when
   * they become empty and {@link View.autoLayers} is false.
   */
  readonly onViewLayerDestroyed: EventEmitter<View, ViewLayer>;

  //---------------------------- Camera Events ----------------------------//

  /**
   * Emits an event each time {@link Camera.projectionType} updates within a {@link viewing!viewer.View | View}.
   */
  readonly onCameraProjectionTypeChanged: EventEmitter<View, Camera>;

  /**
   * Emits an event each time {@link Camera.viewMatrix} updates within a {@link viewing!viewer.View | View}.
   */
  readonly onCameraViewMatrixUpdated: EventEmitter<View, Camera>;

  /**
   * Emits an event each time {@link Camera.projMatrix} updates within a {@link viewing!viewer.View | View}.
   */
  readonly onCameraProjMatrixUpdated: EventEmitter<View, Camera>;

  /**
   * Emits an event each time {@link Camera.frustum} updates on a {@link Camera}.
   */
  readonly onCameraFrustumUpdated: EventEmitter<Camera, Frustum3>;

  //---------------------------- Section Plane Events ----------------------------//

  /**
   * Emits an event each time a {@link SectionPlane} is created within a {@link viewing!viewer.View | View}.
   */
  readonly onSectionPlaneCreated: EventEmitter<View, SectionPlane>;

  /**
   * Emits an event each time a {@link SectionPlane} is destroyed within a {@link viewing!viewer.View | View}.
   */
  readonly onSectionPlaneDestroyed: EventEmitter<View, SectionPlane>;

  /**
   * Emits an event each time {@link SectionPlane.pos} changes on a {@link SectionPlane}.
   */
  readonly onSectionPlanePosChanged: EventEmitter<SectionPlane, Vec3>;

  /**
   * Emits an event each time {@link SectionPlane.dir} changes on a {@link SectionPlane}.
   */
  readonly onSectionPlaneDirChanged: EventEmitter<SectionPlane, Vec3>;

  /**
   * Emits an event each time {@link SectionPlane.active} changes on a {@link SectionPlane}.
   */
  readonly onSectionPlaneActive: EventEmitter<SectionPlane, boolean>

  //---------------------------- View Transform Events ----------------------------//

  /**
   * Emits an event each time a {@link ViewTransform} is created within a {@link viewing!viewer.View | View}.
   */
  readonly onViewTransformCreated: EventEmitter<View, ViewTransform>;

  /**
   * Emits an event each time a {@link ViewTransform} is destroyed within a {@link viewing!viewer.View | View}.
   */
  readonly onViewTransformDestroyed: EventEmitter<View, ViewTransform>;

    /**
    * Emits an event each time a {@link ViewTransform} updates within a {@link viewing!viewer.View | View}.
    */
  readonly onViewTransformUpdated: EventEmitter<ViewTransform, ViewTransform>;

  //---------------------------- Snapshot Events ----------------------------//

  /**
   * Emits an event each time a snapshot is initiated within a {@link viewing!viewer.View | View} via {@link viewing!viewer.View.getSnapshot | View.getSnapshot}.
   */
  readonly onSnapshotStarted: EventEmitter<View, SnapshotStartedEvent>;

  /**
   * Emits an event each time a snapshot is completed within a {@link viewing!viewer.View | View} via {@link viewing!viewer.View.getSnapshot | View.getSnapshot}.
   */
  readonly onSnapshotFinished: EventEmitter<View, SnapshotFinishedEvent>;

  //---------------------------- View Dirty Events ----------------------------//

  /**
   * Emits an event each time a {@link viewing!viewer.View | View} becomes dirty (within the {@link viewing!viewer.Viewer | Viewer}), requiring a redraw.
   */
  readonly onViewUpdated: EventEmitter<View, View>;

  /**
   * @private
   */
  constructor() {

    this.onError = new EventEmitter<Viewer, SDKResult<any>>(new EventDispatcher());
    this.onSceneAttached = new EventEmitter(new EventDispatcher<Viewer, Scene>());
    this.onSceneDetached = new EventEmitter(new EventDispatcher<Viewer, Scene>());
    this.onViewerDestroyed = new EventEmitter(new EventDispatcher<Viewer, boolean>());
    this.onTick = new EventEmitter(new EventDispatcher<Viewer, TickParams>());
    this.log = new EventEmitter(new EventDispatcher<Viewer, string>());
    this.onEffectCreated = new EventEmitter(new EventDispatcher<Viewer, Effect>());
    this.onEffectDestroyed = new EventEmitter(new EventDispatcher<Viewer, Effect>());
    this.onViewCreated = new EventEmitter(new EventDispatcher<Viewer, View>());
    this.onViewUpdated = new EventEmitter(new EventDispatcher<View, View>());
    this.onViewDestroyed = new EventEmitter(new EventDispatcher<Viewer, View>());
    this.onViewCanvasBoundaryChanged = new EventEmitter(new EventDispatcher<View, IntArrayParam>());
    this.onViewObjectCreated = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectDestroyed = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectVisibleChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectSelectedChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectHighlightedChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectXRayedChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectClippableChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectCulledChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectColorizeChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectOpacityChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewObjectPickableChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
    this.onViewLayerCreated = new EventEmitter(new EventDispatcher<View, ViewLayer>());
    this.onViewLayerDestroyed = new EventEmitter(new EventDispatcher<View, ViewLayer>());
    this.onCameraProjectionTypeChanged = new EventEmitter(new EventDispatcher<View, Camera>());
    this.onCameraViewMatrixUpdated = new EventEmitter(new EventDispatcher<View, Camera>());
    this.onCameraProjMatrixUpdated = new EventEmitter(new EventDispatcher<View, Camera>());
    this.onCameraFrustumUpdated = new EventEmitter(new EventDispatcher<Camera, Frustum3>());
    this.onSectionPlaneCreated = new EventEmitter(new EventDispatcher<View, SectionPlane>());
    this.onSectionPlaneDestroyed = new EventEmitter(new EventDispatcher<View, SectionPlane>());
    this.onSectionPlanePosChanged = new EventEmitter(new EventDispatcher<SectionPlane, Vec3>());
    this.onSectionPlaneDirChanged = new EventEmitter(new EventDispatcher<SectionPlane, Vec3>());
    this.onSectionPlaneActive = new EventEmitter(new EventDispatcher<SectionPlane, boolean>());
    this.onViewTransformCreated = new EventEmitter(new EventDispatcher<View, ViewTransform>());
    this.onViewTransformDestroyed = new EventEmitter(new EventDispatcher<View, ViewTransform>());
    this.onViewTransformUpdated = new EventEmitter(new EventDispatcher<ViewTransform, ViewTransform>());
    this.onSnapshotStarted = new EventEmitter(new EventDispatcher<View, SnapshotStartedEvent>());
    this.onSnapshotFinished = new EventEmitter(new EventDispatcher<View, SnapshotFinishedEvent>());
  }

  /**
   * @private
   */
  destroy() {
    this.onError.clear();
    this.onSceneAttached.clear();
    this.onSceneDetached.clear();
    this.onViewerDestroyed.clear();
    this.onTick.clear();
    this.log.clear();
    this.onEffectCreated.clear();
    this.onEffectDestroyed.clear();
    this.onViewCreated.clear();
    this.onViewUpdated.clear();
    this.onViewDestroyed.clear();
    this.onViewCanvasBoundaryChanged.clear();
    this.onViewObjectCreated.clear();
    this.onViewObjectDestroyed.clear();
    this.onViewObjectVisibleChanged.clear();
    this.onViewObjectXRayedChanged.clear();
    this.onViewObjectClippableChanged.clear();
    this.onViewObjectCulledChanged.clear();
    this.onViewObjectSelectedChanged.clear();
    this.onViewObjectHighlightedChanged.clear();
    this.onViewObjectColorizeChanged.clear();
    this.onViewObjectOpacityChanged.clear();
    this.onViewObjectPickableChanged.clear();
    this.onViewLayerCreated.clear();
    this.onViewLayerDestroyed.clear();
    this.onCameraProjectionTypeChanged.clear();
    this.onCameraViewMatrixUpdated.clear();
    this.onCameraProjMatrixUpdated.clear();
    this.onCameraFrustumUpdated.clear();
    this.onSectionPlaneCreated.clear();
    this.onSectionPlaneDestroyed.clear();
    this.onSectionPlanePosChanged.clear();
    this.onSectionPlaneDirChanged.clear();
    this.onSectionPlaneActive.clear();
    this.onViewTransformCreated.clear();
    this.onViewTransformDestroyed.clear();
    this.onViewTransformUpdated.clear();
    this.onSnapshotStarted.clear();
    this.onSnapshotFinished.clear();
  }
}
