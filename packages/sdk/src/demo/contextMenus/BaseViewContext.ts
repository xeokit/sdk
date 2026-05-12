/**
 * Shared context shape for menus that operate on a view.
 *
 * Carries every resource a context-menu builder needs to read or
 * mutate scene / data / view state. Both the per-object
 * {@link ViewObjectContextMenuContext} and the canvas-level
 * {@link CanvasContextMenuContext} extend it.
 *
 * @module demo/viewObjectContextMenu/BaseViewContext
 */

import type {ViewObject} from "../../viewer";
import type {SceneCollisionIndex} from "../../collision";
import type {SceneModel} from "../../scene";
import type {DataModel} from "../../data";
import type {CameraFlightAnimation} from "../../cameraFlight";
import type {WebGLRenderer} from "../../webGLRenderer";
import type {DemoHelper} from "../DemoHelper";


export interface BaseViewContext {
  /** Demo helper used for view and inspector actions. */
  demoHelper: DemoHelper;

  /** WebGL renderer used for capturing screenshots and other renderer-related actions. */
  renderer: WebGLRenderer;

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
