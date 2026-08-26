/**
 * Shared context shape for menus that operate on a view.
 *
 * Carries every resource a context-menu builder needs to read or
 * mutate scene / data / view state. Both the per-object
 * {@link ViewObjectContextMenuContext} and the canvas-level
 * {@link CanvasContextMenuContext} extend it.
 *
 * @module studio/viewObjectContextMenu/BaseViewContext
 */

import type {ViewObject} from "@xeokit/sdk/viewing/viewer";
import type {SceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import type {SceneModel} from "@xeokit/sdk/model/scene";
import type {DataModel} from "@xeokit/sdk/model/data";
import type {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import type {Renderer} from "@xeokit/sdk/viewing/rendering";
import type {Studio} from "../Studio";


export interface BaseViewContext {
  /** Demo helper used for view and inspector actions. */
  studio: Studio;

  /** Renderer used for capturing screenshots and other renderer-related actions. */
  renderer: Renderer;

  /** Camera flight controller used for framing actions. */
  cameraFlight: CameraFlightAnimation;

  /** Active view for the context menu. */
  view: ViewObject["view"];

  /** Scene model associated with the current view. */
  sceneModel: SceneModel;

  /** Optional data model associated with the current scene model. */
  dataModel?: DataModel;

  /** Spatial index used to resolve object and scene bounds. */
  collisionIndex: SceneCollisionIndex;
}
