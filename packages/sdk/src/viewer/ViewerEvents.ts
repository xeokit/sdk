import {Viewer} from "./Viewer";
import {EventEmitter} from "../core";
import {TickParams} from "./TickParams";
import {SnapshotFinishedEvent, SnapshotStartedEvent, View} from "./View";
import {FloatArrayParam, IntArrayParam} from "../math";
import {ViewObject} from "./ViewObject";
import {ViewLayer} from "./ViewLayer";
import {SectionPlane} from "./SectionPlane";
import {Frustum3} from "../boundaries";
import {Camera} from "./Camera";
import {EventDispatcher} from "strongly-typed-events";
import {Spinner} from "./Spinner";

/**
 * Events emitted by a {@link viewer!Viewer | Viewer}.
 */
export class ViewerEvents {

    //---------------------------- Viewer Events ----------------------------//

    /**
     * Emits an event each time a Viewer "tick" occurs (~10-60 times per second).
     */
    readonly onTick: EventEmitter<Viewer, TickParams>;

    /**
     * Emits an event each time a message is logged.
     */
    readonly log: EventEmitter<Viewer, string>;

    /**
     * Emits an event each time the number of active processes changes.
     */
    readonly processes: EventEmitter<Spinner, number>;

    /**
     * Emits an event each time the number of active processes reaches zero.
     */
    readonly zeroProcesses: EventEmitter<Spinner, number>;

    //---------------------------- View Events ----------------------------//

    /**
     * Emits an event each time a {@link View} is created.
     */
    readonly onViewCreated: EventEmitter<Viewer, View>;

    /**
     * Emits an event each time a {@link View} is destroyed.
     */
    readonly onViewDestroyed: EventEmitter<Viewer, View>;

    /**
     * Emits an event each time the canvas boundary changes.
     */
    readonly onViewCanvasBoundaryChanged: EventEmitter<View, IntArrayParam>;

    //---------------------------- ViewObject Events ----------------------------//

    /**
     * Emits an event each time a {@link ViewObject} is created.
     */
    readonly onViewObjectCreated: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time a {@link ViewObject} is destroyed.
     */
    readonly onViewObjectDestroyed: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time the visibility of a {@link ViewObject} changes.
     *
     * ViewObjects are shown and hidden with {@link View.setObjectsVisible}, {@link ViewLayer.setObjectsVisible} or {@link ViewObject.visible}.
     */
    readonly onViewObjectVisibleChanged: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time the selected state of a {@link ViewObject} changes.
     *
     * ViewObjects are selected with {@link View.setObjectsSelected}, {@link ViewLayer.setObjectsSelected} or {@link ViewObject.selected}.
     */
    readonly onViewObjectSelectedChanged: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time the highlight state of a {@link ViewObject} changes.
     *
     * ViewObjects are highlighted with {@link View.setObjectsHighlighted}, {@link ViewLayer.setObjectsHighlighted} or {@link ViewObject.highlighted}.
     */
    readonly onViewObjectHighlightedChanged: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time the X-ray state of a {@link ViewObject} changes.
     *
     * ViewObjects are X-rayed with {@link View.setObjectsXRayed}, {@link ViewLayer.setObjectsXRayed} or {@link ViewObject.xrayed}.
     */
    readonly onViewObjectXRayedChanged: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time the colorization of a {@link ViewObject} changes.
     *
     * ViewObjects are colorized with {@link View.setObjectsColorized}, {@link ViewLayer.setObjectsColorized} or {@link ViewObject.colorize}.
     */
    readonly onViewObjectColorizeChanged: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time the opacity of a {@link ViewObject} changes.
     *
     * ViewObjects have their opacity changed with {@link View.setObjectsOpacity}, {@link ViewLayer.setObjectsOpacity} or {@link ViewObject.opacity}.
     */
    readonly onViewObjectOpacityChanged: EventEmitter<View, ViewObject>;

    //---------------------------- ViewLayer Events ----------------------------//

    /**
     * Emits an event each time a {@link ViewLayer} is created.
     *
     * Layers are created explicitly with {@link View.createLayer}, or implicitly with {@link scene!SceneModel.createObject | SceneModel.createObject} and {@link scene!SceneObjectParams.layerId | SceneObjectParams.layerId}.
     */
    readonly onViewLayerCreated: EventEmitter<View, ViewLayer>;

    /**
     * Emits an event each time a {@link ViewLayer} is destroyed.
     *
     * ViewLayers are destroyed explicitly with {@link ViewLayer.destroy}, or implicitly when they become empty and {@link View.autoLayers} is false.
     */
    readonly onViewLayerDestroyed: EventEmitter<View, ViewLayer>;

   //---------------------------- Camera Events ----------------------------//

    /**
     * Emits an event each time {@link Camera.projectionType} updates.
     */
    readonly onCameraProjectionTypeChanged: EventEmitter<View, Camera>;

    /**
     * Emits an event each time {@link Camera.viewMatrix} updates.
     */
    readonly onCameraViewMatrixUpdated: EventEmitter<View, Camera>;

    /**
     * Emits an event each time {@link Camera.projMatrix} updates.
     */
    readonly onCameraProjMatrixUpdated: EventEmitter<View, Camera>;

    /**
     * Emits an event each time {@link Camera.frustum} updates.
     */
    readonly onCameraFrustumUpdated: EventEmitter<Camera, Frustum3>;

//---------------------------- Section Plane Events ----------------------------//

    /**
     * Emits an event each time a {@link SectionPlane} is created.
     */
    readonly onSectionPlaneCreated: EventEmitter<View, SectionPlane>;

    /**
     * Emits an event each time a {@link SectionPlane} is destroyed.
     */
    readonly onSectionPlaneDestroyed: EventEmitter<View, SectionPlane>;

    /**
     * Emits an event each time a {@link SectionPlane.pos} changes.
     */
    readonly onSectionPlanePosChanged : EventEmitter<SectionPlane, FloatArrayParam>;

    /**
     * Emits an event each time a {@link SectionPlane.dir} changes.
     */
    readonly onSectionPlaneDirChanged : EventEmitter<SectionPlane, FloatArrayParam>;

    /**
     * Emits an event each time a {@link SectionPlane.active} changes.
     */
    readonly onSectionPlaneActive : EventEmitter<SectionPlane, boolean>;

    //---------------------------- Snapshot Events ----------------------------//

    /**
     * Emits an event each time a snapshot is initiated with {@link View.getSnapshot}.
     */
    readonly onSnapshotStarted: EventEmitter<View, SnapshotStartedEvent>;

    /**
     * Emits an event each time a snapshot is completed with {@link View.getSnapshot}.
     */
    readonly onSnapshotFinished: EventEmitter<View, SnapshotFinishedEvent>;

    //---------------------------- View Dirty Events ----------------------------//

    /**
     * Emits an event each time a {@link View} becomes dirty, requiring a redraw.
     */
    readonly onViewUpdated: EventEmitter<View, View>;

    /**
     * @private
     */
    constructor() {

        this.onTick = new EventEmitter(new EventDispatcher<Viewer, TickParams>());
        this.processes = new EventEmitter(new EventDispatcher<Spinner, number>());
        this.zeroProcesses = new EventEmitter(new EventDispatcher<Spinner, number>());
        this.log = new EventEmitter(new EventDispatcher<Viewer, string>());
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
        this.onViewObjectColorizeChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
        this.onViewObjectOpacityChanged = new EventEmitter(new EventDispatcher<View, ViewObject>());
        this.onViewLayerCreated = new EventEmitter(new EventDispatcher<View, ViewLayer>());
        this.onViewLayerDestroyed = new EventEmitter(new EventDispatcher<View, ViewLayer>());
        this.onCameraProjectionTypeChanged = new EventEmitter(new EventDispatcher<View, Camera>());
        this.onCameraViewMatrixUpdated = new EventEmitter(new EventDispatcher<View, Camera>());
        this.onCameraProjMatrixUpdated = new EventEmitter(new EventDispatcher<View, Camera>());
        this.onCameraFrustumUpdated = new EventEmitter(new EventDispatcher<Camera, Frustum3>());
        this.onSectionPlaneCreated = new EventEmitter(new EventDispatcher<View, SectionPlane>());
        this.onSectionPlaneDestroyed = new EventEmitter(new EventDispatcher<View, SectionPlane>());
        this.onSectionPlanePosChanged = new EventEmitter(new EventDispatcher<SectionPlane, FloatArrayParam>());
        this.onSectionPlaneDirChanged = new EventEmitter(new EventDispatcher<SectionPlane, FloatArrayParam>());
        this.onSectionPlaneActive = new EventEmitter(new EventDispatcher<SectionPlane, boolean>());
        this.onSnapshotStarted = new EventEmitter(new EventDispatcher<View, SnapshotStartedEvent>());
        this.onSnapshotFinished = new EventEmitter(new EventDispatcher<View, SnapshotFinishedEvent>());

    }

    /**
     * @private
     */
    destroy() {
       this.onTick.clear();
        this.log.clear();
         this.onViewCreated.clear();
         this.onViewUpdated.clear();
         this.onViewDestroyed.clear();
            this.onViewCanvasBoundaryChanged.clear();
            this.onViewObjectCreated.clear();
            this.onViewObjectDestroyed.clear();
            this.onViewObjectVisibleChanged.clear();
            this.onViewObjectXRayedChanged.clear();
            this.onViewObjectSelectedChanged.clear();
            this.onViewObjectHighlightedChanged.clear();
            this.onViewObjectColorizeChanged.clear();
            this.onViewObjectOpacityChanged.clear();
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
            this.onSnapshotStarted.clear();
            this.onSnapshotFinished.clear();
    }
}