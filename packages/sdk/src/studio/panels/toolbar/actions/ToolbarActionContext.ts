/**
 * Action-handler dependency surface.
 *
 * The {@link Toolbar} builds one of these and passes it to each
 * {@link ToolbarActionDescriptor.do} call. Action implementations
 * never reach into Toolbar internals directly — they only see this
 * interface, so a host that wants a different Toolbar shell can
 * supply its own context and reuse the same action library.
 *
 */

import type {Viewer, View} from "../../../../viewing/viewer";
import type {Studio} from "../../../Studio";
import type {ViewController} from "../../../../viewing/viewController";
import type {WalkNavigationController} from "../../../../viewing/walkNavigation";
import type {FloatingPanelBase} from "../../floatingPanelBase";
import type {ToolbarAction} from "../Toolbar";


/**
 * Minimal shape of the camera-flight animator a few actions
 * (Reset / Fit All) drive. Kept narrow so action code does not
 * need to import the full `CameraFlightAnimation` type just to
 * call `flyTo` / `jumpTo`.
 */
export interface CameraFlightLike {
  flyTo:  (params: any) => void;
  jumpTo: (params: any) => void;
}

/**
 * Everything a Toolbar action needs to run, in one struct.
 * Action implementations only depend on this interface, never on
 * the concrete Toolbar.
 */
export interface ToolbarActionContext {

  /** Viewer the Toolbar is bound to. */
  readonly viewer: Viewer;

  /** Optional Studio, when present. */
  readonly studio?: Studio;

  /**
   * Active View — currently the first entry in
   * `Viewer.viewList`. Same convention as the rest of the
   * Toolbar. Returns `null` if no View has been added yet.
   */
  activeView(): View | null;

  /**
   * Active View's registered {@link ViewController}, read off the
   * {@link Studio}. Returns `null` when no helper is wired or
   * the active View has no registered controller.
   */
  viewController(): ViewController | null;

  /**
   * Active View's walk-navigation controller, lazily created by the host
   * Toolbar when available.
   */
  walkNavigationController(): WalkNavigationController | null;

  /**
   * Active View's registered camera flight, read off the
   * {@link Studio}. Returns `null` when no helper is wired or
   * the active View has no registered flight.
   */
  cameraFlight(): CameraFlightLike | null;

  /**
   * Scene's overall AABB — read off the helper's collision index.
   * Returns `null` when the helper isn't available or the scene
   * has nothing to frame yet.
   */
  sceneAabb(): number[] | null;

  /**
   * Forward an action through the host's `onAction` override
   * (see {@link ToolbarParams.onAction}). Returns `true` when
   * the host claimed the action and the built-in handler should
   * short-circuit.
   */
  fireAction(action: ToolbarAction): boolean;

  /**
   * Set the `aria-pressed` state on the button registered against
   * `action`. No-op when no button is registered (e.g. the action
   * is fired without a corresponding visible button).
   */
  setPressed(action: ToolbarAction, pressed: boolean): void;

  /**
   * Subscribe a panel-toggle button to its panel's visibility, so
   * the button stays in sync when the panel is closed via its X
   * (or any other path that does not go through the Toolbar).
   * Idempotent — safe to call on every action invocation.
   */
  bindPanelSync(panel: FloatingPanelBase, action: ToolbarAction): void;
}
