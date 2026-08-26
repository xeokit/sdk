import type {AircraftForwardAxis, Vec3} from "./AircraftMath";
import type {AircraftExhaustTrail} from "./AircraftExhaustTrail";

export type SceneTransform = any;
export type View = any;
export type ModelNavigationController = any;
export type VehicleNavigationControllerConstructor = new (view: any, params: any) => any;

/**
 * Built-in camera viewpoints managed by {@link AircraftController}.
 *
 * These are selected programmatically via
 * {@link AircraftController.setCameraPreset} or, when keyboard binding is
 * enabled, with number keys `0` through `7`.
 */
export type AircraftCameraPreset = "trailing" | "left" | "right" | "front" | "top" | "topTrailing" | "rearWide" | "cockpit";

/**
 * Visual configuration for {@link AircraftExhaustTrail}.
 *
 * The trail is represented by a dynamic SceneModel made from short translucent
 * tube segments. The emitter follows an aircraft-local offset transformed by
 * the controller's current aircraft pose.
 */
export interface AircraftExhaustConfig {
  /** Optional ID for the generated exhaust SceneModel. Defaults to `${modelId}Exhaust`. */
  modelId?: string;
  /** Aircraft-local emitter position. Interpreted using {@link AircraftControllerConfig.forwardAxis}. */
  offset?: ArrayLike<number>;
  /** Number of radial sides used for each tube segment. */
  radialSegments?: number;
  /** Base radius of the exhaust trail near the emitter. */
  radius?: number;
  /** Amount of sideways trail curl/wander. */
  wander?: number;
  /** Number of dynamic trail tube segments. */
  trailSegments?: number;
  /** Approximate model-space trail length. */
  trailLength?: number;
  /** Starting opacity for the trail; later segments fade out. */
  trailOpacity?: number;
  /** Radius growth along the trail. */
  trailExpansion?: number;
  /** Fraction of aircraft movement carried into existing trail samples. */
  trailAdvection?: number;
  /** Spring strength that tethers old samples back toward the current emitter path. */
  trailTether?: number;
  /** Optional afterburner flame attached to the same emitter. */
  afterburner?: boolean | AircraftAfterburnerConfig;
}

/**
 * Optional flame rendered at the aircraft exhaust point when speed is high.
 *
 * Set `true` to use defaults or pass this object to tune threshold, length,
 * radius and flicker.
 */
export interface AircraftAfterburnerConfig {
  /** Explicitly disable an inherited/configured afterburner. */
  enabled?: boolean;
  /** Normalized speed threshold in `[0, 1]` before the flame appears. */
  threshold?: number;
  /** Maximum flame length at full speed. */
  length?: number;
  /** Minimum flame length once the threshold is crossed. */
  minLength?: number;
  /** Base flame radius. */
  radius?: number;
  /** Radius multiplier for the bright inner core layer. */
  coreRadiusScale?: number;
  /** Radius multiplier for the outer halo layer. */
  haloRadiusScale?: number;
  /** Sinusoidal size variation applied to the flame. */
  flicker?: number;
  /** Number of radial sides used by the flame geometry. */
  radialSegments?: number;
}

/**
 * Runtime configuration for {@link AircraftController}.
 *
 * Most fields are optional overrides around practical defaults. Distances,
 * speeds and offsets are in the active Scene coordinate system. Directional
 * vectors follow the Scene coordinate system's world-up convention.
 */
export interface AircraftControllerConfig {
  /** ID prefix for the aircraft SceneModel, used by the default collision filter. */
  modelId?: string;
  /** Which local aircraft axis points forward. Defaults to `"-Z"`. */
  forwardAxis?: AircraftForwardAxis;
  /** Initial world-space aircraft position. If omitted, derived from the View camera. */
  initialShipPosition?: ArrayLike<number>;
  /** Minimum altitude along world-up; below this, the controller clamps upward. */
  minAltitude?: number;
  /** Initial forward speed. */
  startSpeed?: number;
  /** Whether to start in flight mode. Defaults to `true`. */
  startFlying?: boolean;
  /** Maximum forward speed. */
  maxForwardSpeed?: number;
  /** Maximum reverse speed. */
  maxReverseSpeed?: number;
  /** Ground acceleration. */
  acceleration?: number;
  /** Ground braking deceleration. */
  brakeDeceleration?: number;
  /** Passive deceleration while coasting. */
  coastDeceleration?: number;
  /** Collision body radius supplied to vehicle navigation. */
  bodyRadius?: number;
  /** Enables collision against non-aircraft objects. */
  collision?: boolean;
  /** Enables gravity in the underlying vehicle controller. */
  gravity?: boolean;
  /** Preferred yaw rate name for aircraft demos, in degrees per second. */
  shipYawRateDegreesPerSecond?: number;
  /** Generic yaw rate alias, in degrees per second. */
  turnRateDegreesPerSecond?: number;
  /** Initial keyboard steer multiplier before ramping. */
  shipKeyYawInitialScale?: number;
  /** Generic alias for keyboard steer initial multiplier. */
  keySteerInitialScale?: number;
  /** Seconds for keyboard steering to ramp to full strength. */
  shipKeyYawRampSeconds?: number;
  /** Generic alias for keyboard steering ramp seconds. */
  keySteerRampSeconds?: number;
  /** Maximum visual roll/lean in degrees. */
  maxVisualRollDegrees?: number;
  /** Generic alias for maximum visual roll/lean in degrees. */
  leanDegrees?: number;
  /** Roll smoothing factor. */
  rollSmoothing?: number;
  /** Generic alias for roll smoothing. */
  leanSmoothing?: number;
  /** Minimum pitch angle in degrees. */
  minShipPitchDegrees?: number;
  /** Maximum pitch angle in degrees. */
  maxShipPitchDegrees?: number;
  /** Altitude at which flight mode starts. */
  flightTakeoffHeight?: number;
  /** Speed required before takeoff. */
  flightTakeoffSpeed?: number;
  /** Falling speed used during landing. */
  flightLandingFallSpeed?: number;
  /** Flight acceleration. */
  flightAcceleration?: number;
  /** Flight braking deceleration. */
  flightBrakeDeceleration?: number;
  /** Minimum glide speed while flying. */
  flightMinGlideSpeed?: number;
  /** Alias for minimum forward/glide speed. */
  minForwardSpeed?: number;
  /** Flight drag coefficient. */
  flightAirDrag?: number;
  /** Flight gravity acceleration. */
  flightGravity?: number;
  /** Distance over which landing is softened. */
  flightSoftLandingRange?: number;
  /** Flight pitch rate in degrees per second. */
  flightPitchRateDegreesPerSecond?: number;
  /** Aircraft-demo alias for flight pitch rate. */
  shipPitchRateDegreesPerSecond?: number;
  /** Responsiveness of flight steering. */
  flightSteeringResponse?: number;
  /** Treat flight input as rudder/elevator deflection. Defaults to `true` for aircraft controllers. */
  aircraftControlSurfaces?: boolean;
  /** Rudder/elevator deflection response while arrow keys are held. */
  controlSurfaceResponse?: number;
  /** Rudder/elevator return-to-neutral response after arrow keys are released. */
  controlSurfaceReturnResponse?: number;
  /** Mouse-drag yaw sensitivity. */
  shipMouseDragYawSensitivity?: number;
  /** Generic alias for mouse-drag yaw sensitivity. */
  mouseDragYawSensitivity?: number;
  /** Mouse-drag pitch sensitivity. */
  shipMouseDragPitchSensitivity?: number;
  /** Generic alias for mouse-drag pitch sensitivity. */
  mouseDragPitchSensitivity?: number;
  /** Shared mouse-drag sensitivity fallback. */
  shipMouseDragSensitivity?: number;
  /** Generic mouse-drag response smoothing. */
  mouseDragResponse?: number;
  /** Aircraft-demo alias for mouse-drag response smoothing. */
  shipMouseDragResponse?: number;
  /** Maximum mouse-drag input consumed in one frame. */
  maxShipMouseDragInputPerFrame?: number;
  /** Generic alias for maximum mouse-drag input per frame. */
  maxMouseDragInputPerFrame?: number;
  /** Base chase-camera distance. */
  cameraDistance?: number;
  /** Base chase-camera height. */
  cameraHeight?: number;
  /** Distance ahead of the aircraft that the chase camera looks. */
  cameraLookAhead?: number;
  /** World-up offset added to camera look targets. */
  cameraLookHeight?: number;
  /** Right-axis offset for the trailing camera. */
  cameraLateralOffset?: number;
  /** Smoothing factor for exterior camera eye movement. */
  cameraFollowSmoothing?: number;
  /** Smoothing factor for exterior camera look movement. */
  cameraLookSmoothing?: number;
  /** Rolls exterior chase cameras with the aircraft instead of keeping the horizon level. */
  cameraRollWithAircraft?: boolean;
  /** Fraction of aircraft roll applied to exterior chase cameras when roll-follow is enabled. */
  cameraRollWithAircraftScale?: number;
  /** Blend amount toward an exhaust-tethered trailing camera. */
  cameraTrailFollow?: number;
  /** Up offset used by the exhaust-tethered trailing camera. */
  cameraTrailHeight?: number;
  /** Initial multiplier for exterior camera distances. */
  cameraExteriorDistanceScale?: number;
  /** Multiplicative step used by `-` / `+` exterior-camera zoom keys. */
  cameraExteriorDistanceStep?: number;
  /** Minimum exterior distance multiplier. */
  cameraExteriorMinDistanceScale?: number;
  /** Maximum exterior distance multiplier. */
  cameraExteriorMaxDistanceScale?: number;
  /** Side-camera distance multiplier. */
  cameraSideDistanceScale?: number;
  /** Side-camera height multiplier. */
  cameraSideHeightScale?: number;
  /** Side-camera look-ahead multiplier. */
  cameraSideLookAheadScale?: number;
  /** Front-camera distance multiplier. */
  cameraFrontDistanceScale?: number;
  /** Front-camera height multiplier. */
  cameraFrontHeightScale?: number;
  /** Front-camera look-ahead multiplier. */
  cameraFrontLookAheadScale?: number;
  /** Minimum front-camera distance from the aircraft. */
  cameraFrontMinDistance?: number;
  /** Front-camera minimum distance as a fraction of desired distance. */
  cameraFrontMinDistanceScale?: number;
  /** Top-camera height. */
  cameraTopHeight?: number;
  /** Backward offset for the top-trailing camera. */
  cameraTopTrailingDistance?: number;
  /** Rear-wide camera distance multiplier. */
  cameraRearWideDistanceScale?: number;
  /** Rear-wide camera height multiplier. */
  cameraRearWideHeightScale?: number;
  /** Rear-wide camera look-ahead multiplier. */
  cameraRearWideLookAheadScale?: number;
  /** Aircraft-local cockpit eye offset. */
  cameraCockpitEyeOffset?: ArrayLike<number>;
  /** Aircraft-local cockpit look target offset. */
  cameraCockpitLookOffset?: ArrayLike<number>;
  /** Smoothing factor for rendered aircraft pose. Use `0` for exact pose. */
  vehicleVisualSmoothing?: number;
  /** Exhaust trail configuration. */
  exhaust?: AircraftExhaustConfig;
  /** Backward-compatible exhaust trail flag/config alias. */
  exhaustPlume?: boolean | AircraftExhaustConfig;
  /** Afterburner config, shared with the exhaust emitter. */
  afterburner?: boolean | AircraftAfterburnerConfig;
  /** Allows demos to pass through extra controller-specific values. */
  [key: string]: unknown;
}

/**
 * Constructor parameters for {@link AircraftController}.
 */
export interface AircraftControllerParams {
  /** Root transform that the controller rewrites each frame. */
  rootTransform: SceneTransform;
  /** Optional flight, camera and visual configuration. */
  config?: AircraftControllerConfig;
  /** Optional exhaust trail to update from the controller state. */
  exhaust?: AircraftExhaustTrail | null;
  /** ModelNavigationController to suspend while vehicle navigation owns input. */
  suspendModelNavigationController?: ModelNavigationController;
  /** SDK navigation controller class used by the example-level aircraft adapter. */
  VehicleNavigationController?: VehicleNavigationControllerConstructor;
  /** Collision/object filter. Return `true` for non-aircraft scene objects. */
  objectFilter?: (objectId: string) => boolean;
  /** Whether to bind number and `-` / `+` camera keys. Defaults to `true`. */
  bindKeyboard?: boolean;
  /** Diagnostic task name used for the repeating animation task. */
  taskName?: string;
}

/**
 * Mutable aircraft state maintained by {@link AircraftController}.
 */
export interface AircraftControllerState {
  /** Physical world-space aircraft position. */
  position: Vec3;
  /** Physical forward direction. */
  forward: Vec3;
  /** Physical right direction. */
  right: Vec3;
  /** Physical up direction. */
  up: Vec3;
  /** Smoothed visual world-space aircraft position. */
  visualPosition: Vec3;
  /** Smoothed visual forward direction. */
  visualForward: Vec3;
  /** Smoothed visual right direction. */
  visualRight: Vec3;
  /** Smoothed visual up direction. */
  visualUp: Vec3;
  /** Current View camera eye written by the controller. */
  cameraEye: Vec3;
  /** Current View camera look target written by the controller. */
  cameraLook: Vec3;
  /** Active camera preset. */
  cameraPreset: AircraftCameraPreset;
  /** Current exterior-camera distance multiplier. */
  exteriorCameraDistanceScale: number;
  /** Last update timestamp in milliseconds. */
  lastTime: number;
}

/**
 * Camera tuple produced by an aircraft camera preset.
 */
export interface AircraftCameraSnapshot {
  /** Camera eye position. */
  eye: Vec3;
  /** Camera look target. */
  look: Vec3;
  /** Camera up vector. */
  up: Vec3;
}

/**
 * Minimal View-like object passed to {@link VehicleNavigationController}.
 */
export interface AircraftControllerViewProxy {
  id: string;
  htmlElement: HTMLElement;
  camera: any;
  objects: any;
  viewer: any;
  /** Marks the real View dirty when vehicle navigation changes the proxy camera. */
  needsRender?: () => void;
}
