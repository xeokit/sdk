/**
 * # xeokit Globe Navigation
 *
 * ---
 *
 * **Virtual-globe camera navigation for a
 * {@link viewing!viewer.View | View}: surface-pick drag, pole-axis spin,
 * constrained pole tilt, wheel zoom, point-orbit mode and damped inertia.**
 *
 * ---
 *
 * The `navigation/globe` module provides
 * {@link GlobeNavigationController}, a camera controller for Earth-scale
 * spherical scenes. It is intended for streamed global datasets, terrain
 * globes and other models where the user expects to grab the visible surface,
 * spin the planet, zoom in and temporarily orbit around a picked point.
 *
 * Unlike the general-purpose ModelNavigationController, `GlobeNavigationController` keeps globe spin constrained to
 * a pole axis while allowing the viewpoint to tilt toward either pole. It also
 * protects against pole singularities, polar surface-pick amplification and
 * release-time inertia spikes.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class GlobeNavigationController {
 *       +view : View
 *       +center : number[]
 *       +radius : number
 *       +worldUp : number[]
 *       +active : boolean
 *       +spinAboutCenter()
 *       +orbitAbout(point)
 *       +destroy()
 *     }
 *     class GlobeNavigationControllerParams {
 *       +active?
 *       +suspendModelNavigationController?
 *       +center?
 *       +radius?
 *       +worldUp?
 *       +minAltitude?
 *       +maxAltitude?
 *       +rotateSpeed?
 *       +zoomSpeed?
 *       +inertiaTime?
 *       +maxViewLatitudeDegrees?
 *       +polarDragFallbackStartDegrees?
 *     }
 *     class View {
 *       <<viewer>>
 *     }
 *     class Camera {
 *       <<viewer>>
 *     }
 *     class ModelNavigationController {
 *       <<navigation/model>>
 *     }
 *     GlobeNavigationController o-- View : controls Camera
 *     GlobeNavigationController ..> GlobeNavigationControllerParams : reads
 *     GlobeNavigationController ..> ModelNavigationController : can suspend
 *     View *-- Camera
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Surface-pick dragging** — normal drags start by picking the globe under
 *   the pointer, then solve camera motion so the grabbed surface point tracks
 *   the drag without using arbitrary free-roll axes.
 * - **Pole-axis spin** — horizontal motion rotates about `worldUp`, so the
 *   globe reads as spinning about its poles.
 * - **Constrained pole tilt** — vertical motion tilts the viewpoint toward or
 *   away from the poles, clamped by `maxViewLatitudeDegrees` to avoid
 *   upside-down camera states.
 * - **Polar safeguards** — high-latitude drags are damped and the polar cap can
 *   fall back to predictable screen-delta rotation where exact surface solving
 *   becomes ill-conditioned.
 * - **Damped inertia** — release momentum is low-pass filtered and loses energy
 *   on pointer-up, so deliberate flicks coast while drag-stop-release does not
 *   add a kick.
 * - **Point orbit mode** — modifier-click/drag on the globe switches to
 *   orbiting and zooming around the picked surface point. Press `Escape` or
 *   `C` to return to center-spin mode.
 * - **Double-click handoff** — double-clicking a globe point eases the camera
 *   to look at that point without zooming. When `suspendModelNavigationController` is
 *   configured, the picked point is assigned to the standard
 *   ModelNavigationController pivot and
 *   globe navigation deactivates so that controller resumes.
 *
 * <br>
 *
 * ## Usage
 *
 * ```ts
 * import {GlobeNavigationController} from "@xeokit/sdk/viewing/navigation/globe";
 *
 * const globeController = new GlobeNavigationController(view, {
 *   radius: 6371000,
 *   center: [0, 0, 0],
 *   worldUp: [0, 0, 1],
 *   minAltitude: 1000,
 *   maxAltitude: 150000000,
 *   doubleClickLookDuration: 450,
 *   suspendModelNavigationController: existingModelNavigationController
 * });
 *
 * // Return from point-orbit mode to globe-center spin mode.
 * globeController.spinAboutCenter();
 * ```
 *
 * @module globe
 */

export * from "./GlobeNavigationController";
export * from "./GlobeNavigationControllerParams";
