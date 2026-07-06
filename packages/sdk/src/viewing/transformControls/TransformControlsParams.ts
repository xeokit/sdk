import type {PickStrategy} from "../../spatial/picking";
import type {View} from "../viewer/View";
import type {ViewController} from "../viewController";
import type {TransformControlsMode} from "./TransformControlsMode";
import type {TransformControlsSpace} from "./TransformControlsSpace";
import type {TransformControlsTarget} from "./TransformControlsTarget";

/**
 * Constructor parameters for {@link TransformControls}.
 */
export interface TransformControlsParams {

  /**
   * The {@link viewing!viewer.View | View} the controls attach to.
   * The constructor creates its own
   * {@link viewing!viewer.ViewLayer | ViewLayer} and
   * {@link model!scene.SceneModel | SceneModel} within this view's
   * scene to host the gizmo geometry.
   */
  view: View;

  /**
   * Optional {@link viewing!viewController.ViewController | ViewController}
   * to suspend while a handle is being dragged.
   *
   * Without this, the orbit controller's `mousemove` listener still
   * fires alongside the gizmo's `pointermove` (browsers dispatch the
   * mouse and pointer event families independently, so stopping one
   * does not stop the other), and the camera orbits in lockstep with
   * the drag.
   *
   * When provided, the controls set `viewController.active = false`
   * on drag start and restore the prior value on drag end.
   */
  viewController?: ViewController;

  /**
   * {@link spatial!picking.PickStrategy | PickStrategy} used to
   * identify which handle is under the pointer. The controls call
   * `picker.pick({ view, ray, filter })` with a filter that restricts
   * hits to the gizmo's own handle ids, so host-scene objects are
   * ignored.
   *
   * When omitted, TransformControls creates a BVH picker for the
   * view's scene.
   */
  picker?: PickStrategy;

  /**
   * Unique id for the controls' internal SceneModel and ViewLayer.
   * Defaults to `"transformControls"`.
   */
  id?: string;

  /**
   * Initial target. Pass `null` (or omit) to construct with no target
   * — the controls stay hidden until {@link TransformControls.attach}
   * supplies one.
   */
  target?: TransformControlsTarget | null;

  /**
   * Initial mode. Defaults to `"translate"`.
   */
  mode?: TransformControlsMode;

  /**
   * Initial coordinate space. Defaults to `"world"`.
   */
  space?: TransformControlsSpace;

  /**
   * Screen-space size in pixels (approximate handle length on screen).
   * Each frame the controls compute a world-space scale that maps
   * `size` pixels to the handle's unit length, so the rig stays a
   * constant pixel size regardless of camera distance. Defaults to
   * `160`.
   */
  size?: number;

  /**
   * Snap step for translate-mode drags, in world units. Drag deltas
   * are quantised to multiples of this value along each axis. `null`
   * disables snapping (default).
   */
  translationSnap?: number | null;

  /**
   * Snap step for rotate-mode drags, in radians. Drag angles are
   * quantised to multiples of this value. `null` disables snapping
   * (default).
   */
  rotationSnap?: number | null;

  /**
   * Snap step for scale-mode drags, as a multiplicative factor (for
   * example `0.1` snaps to 10% increments). `null` disables snapping
   * (default).
   */
  scaleSnap?: number | null;

  /**
   * Show or hide the X-axis handles. Defaults to `true`.
   */
  showX?: boolean;

  /**
   * Show or hide the Y-axis handles. Defaults to `true`.
   */
  showY?: boolean;

  /**
   * Show or hide the Z-axis handles. Defaults to `true`.
   */
  showZ?: boolean;
}
