import {TrianglesPrimitive} from "../../base/constants";
import type {Mat4} from "../../base/math/matrix";
import type {Vec3} from "../../base/math/vector";
import {type Scene, compressGeometryParams, type SceneModel, type SceneTransform} from "../../model/scene";
import {
  add3,
  aircraftLocalPointToWorld,
  basisFromForward,
  clamp,
  length3,
  lerp3,
  mul3,
  segmentMatrixBetween,
  sub3,
  toVec3,
  type AircraftForwardAxis,
  type AircraftPose
} from "./AircraftMath";
import type {AircraftAfterburnerConfig, AircraftControllerConfig, AircraftControllerState} from "./AircraftControllerParams";

/**
 * Constructor parameters for {@link AircraftExhaustTrail}.
 */
export interface AircraftExhaustTrailParams {
  /** Scene that will own the generated exhaust SceneModel. */
  scene: Scene;
  /** Aircraft model ID used to derive default generated object IDs. */
  modelId: string;
  /** Coordinate system assigned to the generated exhaust SceneModel. */
  coordinateSystem?: unknown;
  /** Shared aircraft config containing exhaust and afterburner settings. */
  config?: AircraftControllerConfig;
}

interface ExhaustSample {
  position: Vec3;
  side: Vec3;
  lift: Vec3;
  forward: Vec3;
  phase: number;
  age: number;
}

interface AfterburnerLayer {
  transform: SceneTransform;
  lengthScale: number;
  radiusScale: number;
  phase: number;
}

/**
 * Dynamic exhaust trail and optional afterburner geometry for
 * {@link AircraftController}.
 *
 * The trail owns a separate dynamic SceneModel. It creates translucent tube
 * segments behind the aircraft and updates their transforms from controller
 * state each frame. When afterburner configuration is present, it also creates
 * three nested flame layers that appear above the configured speed threshold.
 *
 * @example
 * ```ts
 * const exhaust = new AircraftExhaustTrail({
 *   scene,
 *   modelId: "aircraft",
 *   coordinateSystem: aircraftSceneModel.coordinateSystem,
 *   config: {
 *     forwardAxis: "-Z",
 *     exhaust: {
 *       offset: [0, -0.8, 0],
 *       trailLength: 42,
 *       trailSegments: 24
 *     },
 *     afterburner: {
 *       threshold: 0.7,
 *       length: 10
 *     }
 *   }
 * });
 * ```
 */
export class AircraftExhaustTrail {
  /** Generated dynamic SceneModel containing trail and flame geometry. */
  readonly sceneModel: SceneModel;
  /** All generated SceneObject IDs. */
  readonly objectIds: string[] = [];
  /** Generated trail SceneObject IDs. */
  readonly trailObjectIds: string[] = [];
  /** Generated afterburner SceneObject IDs. */
  readonly afterburnerObjectIds: string[] = [];
  /** Mutable transforms for trail segments. */
  readonly trailTransforms: SceneTransform[] = [];
  /** Aircraft-local exhaust emitter offset. */
  readonly offset: Vec3;
  /** Local aircraft axis used as the forward direction. */
  readonly axis: AircraftForwardAxis;
  /** Number of trail segments. */
  readonly trailSegments: number;
  /** Target spacing between generated trail samples. */
  readonly segmentSpacing: number;
  /** Fraction of emitter movement carried by existing samples. */
  readonly trailAdvection: number;
  /** Tether strength pulling samples back toward the emitter path. */
  readonly trailTether: number;
  /** Base trail radius. */
  readonly radius: number;
  /** Radius growth along the trail. */
  readonly trailExpansion: number;
  /** Sideways trail curl amount. */
  readonly wander: number;
  /** Speed used to normalize trail/afterburner intensity. */
  readonly maxForwardSpeed: number;
  /** Resolved afterburner config, or `null` when disabled. */
  readonly afterburner: AircraftAfterburnerConfig | null;

  private readonly afterburnerLayers: AfterburnerLayer[] = [];
  private readonly history: ExhaustSample[] = [];
  private lastEmitter: Vec3 | null = null;
  private lastEmissionPosition: Vec3 | null = null;
  private pulsePhase = 0;
  private sampleSerial = 0;

  /**
   * Creates generated trail geometry and materials.
   */
  constructor({scene, modelId, coordinateSystem, config = {}}: AircraftExhaustTrailParams) {
    const exhaustConfig = typeof config.exhaustPlume === "object" && config.exhaustPlume
      ? config.exhaustPlume
      : (config.exhaust || {});
    const exhaustModelId = exhaustConfig?.modelId || `${modelId}Exhaust`;
    this.sceneModel = unwrapResult(scene.createModel({
      id: exhaustModelId,
      updateHint: "dynamic",
      coordinateSystem: coordinateSystem as never
    }));
    this.axis = config.forwardAxis || "-Z";
    this.offset = Array.isArray(exhaustConfig?.offset)
      ? toVec3(exhaustConfig.offset)
      : [0, 0, 0] as Vec3;

    const radialSegments = Math.max(5, Math.floor(Number(exhaustConfig?.radialSegments ?? 8)));
    this.radius = Number(exhaustConfig?.radius ?? 1.2);
    this.wander = Number(exhaustConfig?.wander ?? 1.4);
    this.trailSegments = Math.max(10, Math.floor(Number(exhaustConfig?.trailSegments ?? 22)));
    const trailLength = Number(exhaustConfig?.trailLength ?? 36);
    const trailOpacity = Number(exhaustConfig?.trailOpacity ?? 0.16);
    this.trailExpansion = Number(exhaustConfig?.trailExpansion ?? 1.35);
    this.trailAdvection = clamp(Number(exhaustConfig?.trailAdvection ?? 0.68), 0, 0.98);
    this.trailTether = Math.max(0, Number(exhaustConfig?.trailTether ?? 1.35));
    this.segmentSpacing = trailLength / this.trailSegments;
    this.maxForwardSpeed = Number(config.maxForwardSpeed ?? 135);
    this.afterburner = resolveAfterburnerConfig(config, exhaustConfig);

    const trailGeometry = compressGeometryParams({
      id: "vehicleExhaustTrailGeometry",
      primitive: TrianglesPrimitive,
      ...createTrailSegmentGeometry(radialSegments)
    });
    trailGeometry.edgeIndices = undefined;
    unwrapResult(this.sceneModel.createGeometryCompressed(trailGeometry));

    for (let i = 0; i < this.trailSegments; i++) {
      const t = this.trailSegments <= 1 ? 0 : i / (this.trailSegments - 1);
      const materialId = `vehicleExhaustTrailMaterial_${i}`;
      const transformId = `vehicleExhaustTrailTransform_${i}`;
      const meshId = `vehicleExhaustTrailMesh_${i}`;
      const objectId = `vehicleExhaustTrail_${i}`;
      const warm = Math.max(0, 1 - t * 1.35);
      const cool = 1 - warm;
      unwrapResult(this.sceneModel.createMaterial({
        id: materialId,
        color: [
          1.0 * warm + 0.50 * cool,
          0.34 * warm + 0.72 * cool,
          0.08 * warm + 0.96 * cool
        ],
        emissiveColor: [
          0.64 * warm + 0.04 * cool,
          0.18 * warm + 0.08 * cool,
          0.02 * warm + 0.16 * cool
        ],
        opacity: Math.max(0.015, trailOpacity * Math.pow(1 - t, 1.25)),
        alphaMode: "BLEND",
        roughness: 0.32,
        metallic: 0
      }));
      const transform = unwrapResult(this.sceneModel.createTransform({
        id: transformId,
        matrix: hiddenExhaustMatrix()
      }));
      unwrapResult(this.sceneModel.createMesh({
        id: meshId,
        geometryId: "vehicleExhaustTrailGeometry",
        materialId,
        parentTransformId: transformId
      }));
      unwrapResult(this.sceneModel.createObject({
        id: objectId,
        meshIds: [meshId],
        clippable: false
      }));
      this.trailTransforms.push(transform);
      this.trailObjectIds.push(objectId);
      this.objectIds.push(objectId);
    }

    if (this.afterburner) {
      this.createAfterburner(this.afterburner);
    }
  }

  /**
   * Updates trail and afterburner transforms from the aircraft controller state.
   *
   * @param config Current aircraft config.
   * @param speed Current forward speed.
   * @param state Current aircraft pose/state.
   * @param dt Elapsed seconds since the previous update.
   */
  update(config: AircraftControllerConfig, speed: number, state: AircraftControllerState, dt: number): void {
    const maxForwardSpeed = Math.max(1, Number(config.maxForwardSpeed ?? this.maxForwardSpeed ?? 135));
    const speedRatio = clamp(Math.max(0, speed) / maxForwardSpeed, 0, 1);
    this.pulsePhase += dt * (0.75 + speedRatio * 1.35);
    this.updateTrail(state, speedRatio, dt);
    this.updateAfterburner(state, speedRatio);
  }

  private updateTrail(state: AircraftControllerState, speedRatio: number, dt: number): void {
    if (!this.trailTransforms.length || !state) {
      return;
    }
    const exhaustState = visualAircraftState(state);
    const emitter = aircraftLocalPointToWorld(this.offset, exhaustState, this.axis);
    const emitterDelta = this.lastEmitter ? sub3(emitter, this.lastEmitter) : [0, 0, 0] as Vec3;

    if (this.history.length === 0) {
      this.seedTrail(exhaustState, emitter);
    } else {
      const carried = mul3(emitterDelta, this.trailAdvection);
      const tetherT = 1 - Math.exp(-this.trailTether * dt);
      for (const sample of this.history) {
        sample.position = add3(sample.position, carried);
        const target = add3(emitter, mul3(exhaustState.forward, -this.segmentSpacing * (this.history.indexOf(sample) + 1)));
        sample.position = lerp3(sample.position, target, tetherT);
      }
      let emissionCursor = this.lastEmissionPosition || this.lastEmitter || emitter;
      let pending = sub3(emitter, emissionCursor);
      let pendingDistance = length3(pending);
      let emitted = 0;
      while (pendingDistance >= this.segmentSpacing && emitted < this.trailSegments) {
        const direction = mul3(pending, 1 / pendingDistance);
        emissionCursor = add3(emissionCursor, mul3(direction, this.segmentSpacing));
        this.history.unshift(this.createSample(emissionCursor, exhaustState, this.sampleSerial++, direction));
        pending = sub3(emitter, emissionCursor);
        pendingDistance = length3(pending);
        emitted++;
      }
      if (emitted > 0) {
        this.history.length = Math.min(this.history.length, this.trailSegments);
        this.lastEmissionPosition = emissionCursor;
      }
    }
    this.lastEmitter = emitter;

    for (const sample of this.history) {
      sample.age += dt;
    }

    const samples = [this.createSample(emitter, exhaustState, this.sampleSerial), ...this.history];
    while (samples.length <= this.trailSegments) {
      const lastSample = samples[samples.length - 1] || samples[0];
      const nextForward = lastSample.forward || exhaustState.forward;
      const nextPosition = add3(lastSample.position, mul3(nextForward, -this.segmentSpacing));
      samples.push({
        position: nextPosition,
        side: lastSample.side,
        lift: lastSample.lift,
        forward: nextForward,
        phase: lastSample.phase + 0.83,
        age: lastSample.age + 0.08
      });
    }

    const displayPoints = samples.map((sample, index) => this.sampleDisplayPosition(sample, index, speedRatio));
    const radiusBoost = 0.84 + speedRatio * 0.55;
    for (let i = 0; i < this.trailTransforms.length; i++) {
      const start = displayPoints[i];
      const end = displayPoints[i + 1];
      const t = this.trailTransforms.length <= 1 ? 0 : i / (this.trailTransforms.length - 1);
      const radius = this.radius * radiusBoost * (0.34 + Math.pow(t, 0.82) * this.trailExpansion);
      this.trailTransforms[i].matrix = segmentMatrixBetween(start, end, radius, samples[i]?.lift || exhaustState.up, samples[i]?.side || exhaustState.right);
    }
  }

  private seedTrail(state: AircraftPose, emitter: Vec3): void {
    this.history.length = 0;
    for (let i = 1; i <= this.trailSegments; i++) {
      const position = add3(emitter, mul3(state.forward, -this.segmentSpacing * i));
      const sample = this.createSample(position, state, this.sampleSerial++);
      sample.age = i * 0.045;
      this.history.push(sample);
    }
    this.lastEmissionPosition = emitter;
  }

  private createSample(position: Vec3, state: AircraftPose, serial: number, forwardOverride: Vec3 | null = null): ExhaustSample {
    const basis = forwardOverride
      ? basisFromForward(forwardOverride, state.up, state.right)
      : state;
    return {
      position,
      side: basis.right,
      lift: basis.up,
      forward: basis.forward,
      phase: serial * 0.73,
      age: 0
    };
  }

  private sampleDisplayPosition(sample: ExhaustSample, index: number, speedRatio: number): Vec3 {
    const t = this.trailSegments <= 0 ? 0 : index / this.trailSegments;
    const curl = this.wander * Math.pow(t, 1.15) * (0.035 + speedRatio * 0.13);
    const phase = sample.phase + sample.age * 0.62 + this.pulsePhase * 0.16;
    return add3(
      add3(sample.position, mul3(sample.side, Math.sin(phase + t * 3.8) * curl)),
      mul3(sample.lift, Math.sin(phase * 1.22 + t * 4.2) * curl * 0.08)
    );
  }

  private createAfterburner(afterburner: AircraftAfterburnerConfig): void {
    const radialSegments = Math.max(5, Math.floor(Number(afterburner.radialSegments ?? 12)));
    const geometry = compressGeometryParams({
      id: "vehicleAfterburnerFlameGeometry",
      primitive: TrianglesPrimitive,
      ...createAfterburnerGeometry(radialSegments)
    });
    geometry.edgeIndices = undefined;
    unwrapResult(this.sceneModel.createGeometryCompressed(geometry));

    const layers = [
      {
        id: "core",
        color: [0.72, 0.92, 1.0] as Vec3,
        emissiveColor: [1.0, 1.0, 1.0] as Vec3,
        opacity: 0.74,
        lengthScale: 0.62,
        radiusScale: Number(afterburner.coreRadiusScale ?? 0.44),
        phase: 0.3
      },
      {
        id: "flame",
        color: [1.0, 0.42, 0.08] as Vec3,
        emissiveColor: [1.0, 0.33, 0.04] as Vec3,
        opacity: 0.58,
        lengthScale: 1.0,
        radiusScale: 1.0,
        phase: 1.8
      },
      {
        id: "halo",
        color: [1.0, 0.12, 0.02] as Vec3,
        emissiveColor: [0.8, 0.08, 0.02] as Vec3,
        opacity: 0.28,
        lengthScale: 1.16,
        radiusScale: Number(afterburner.haloRadiusScale ?? 1.46),
        phase: 2.7
      }
    ];

    for (const layer of layers) {
      const materialId = `vehicleAfterburnerMaterial_${layer.id}`;
      const transformId = `vehicleAfterburnerTransform_${layer.id}`;
      const meshId = `vehicleAfterburnerMesh_${layer.id}`;
      const objectId = `vehicleAfterburner_${layer.id}`;
      unwrapResult(this.sceneModel.createMaterial({
        id: materialId,
        color: layer.color,
        emissiveColor: layer.emissiveColor,
        opacity: layer.opacity,
        alphaMode: "BLEND",
        roughness: 0.12,
        metallic: 0
      }));
      const transform = unwrapResult(this.sceneModel.createTransform({
        id: transformId,
        matrix: hiddenExhaustMatrix()
      }));
      unwrapResult(this.sceneModel.createMesh({
        id: meshId,
        geometryId: "vehicleAfterburnerFlameGeometry",
        materialId,
        parentTransformId: transformId
      }));
      unwrapResult(this.sceneModel.createObject({
        id: objectId,
        meshIds: [meshId],
        clippable: false
      }));
      this.afterburnerLayers.push({
        transform,
        lengthScale: layer.lengthScale,
        radiusScale: layer.radiusScale,
        phase: layer.phase
      });
      this.afterburnerObjectIds.push(objectId);
      this.objectIds.push(objectId);
    }
  }

  private updateAfterburner(state: AircraftControllerState, speedRatio: number): void {
    if (!this.afterburner || this.afterburnerLayers.length === 0) {
      return;
    }
    const threshold = clamp(Number(this.afterburner.threshold ?? 0.62), 0, 0.98);
    const intensity = clamp((speedRatio - threshold) / Math.max(0.01, 1 - threshold), 0, 1);
    if (intensity <= 0.01) {
      for (const layer of this.afterburnerLayers) {
        layer.transform.matrix = hiddenExhaustMatrix();
      }
      return;
    }
    const aircraftState = visualAircraftState(state);
    const emitter = aircraftLocalPointToWorld(this.offset, aircraftState, this.axis);
    const baseLength = Number(this.afterburner.length ?? this.segmentSpacing * 2.2);
    const minLength = Number(this.afterburner.minLength ?? baseLength * 0.36);
    const baseRadius = Number(this.afterburner.radius ?? this.radius * 0.82);
    const flicker = Number(this.afterburner.flicker ?? 0.16);
    const pulse = 1 + Math.sin(this.pulsePhase * 7.5) * flicker + Math.sin(this.pulsePhase * 12.8 + 1.2) * flicker * 0.42;
    const length = (minLength + (baseLength - minLength) * intensity) * Math.max(0.25, pulse);
    const radius = baseRadius * (0.42 + intensity * 0.78);
    const start = add3(emitter, mul3(aircraftState.forward, -0.08 * length));

    for (const layer of this.afterburnerLayers) {
      const layerPulse = 1 + Math.sin(this.pulsePhase * 9.0 + layer.phase) * flicker * 0.55;
      const end = add3(emitter, mul3(aircraftState.forward, -length * layer.lengthScale * layerPulse));
      layer.transform.matrix = segmentMatrixBetween(
        start,
        end,
        radius * layer.radiusScale * Math.max(0.18, layerPulse),
        aircraftState.up,
        aircraftState.right
      );
    }
  }
}

function visualAircraftState(state: AircraftControllerState): AircraftPose {
  return {
    position: state.visualPosition || state.position,
    forward: state.visualForward || state.forward,
    right: state.visualRight || state.right,
    up: state.visualUp || state.up
  };
}

function createTrailSegmentGeometry(radialSegments: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const rings = [
    {y: 0, radius: 0.88},
    {y: 1.0, radius: 1.0}
  ];
  for (const ring of rings) {
    for (let j = 0; j < radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      positions.push(x * ring.radius, ring.y, z * ring.radius);
      normals.push(x, 0, z);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const ring = i * radialSegments;
    const nextRing = (i + 1) * radialSegments;
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const a = ring + j;
      const b = ring + nextJ;
      const c = nextRing + j;
      const d = nextRing + nextJ;
      indices.push(a, c, b, b, c, d);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

function createAfterburnerGeometry(radialSegments: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const rings = [
    {y: 0, radius: 0.7},
    {y: 0.34, radius: 1.0},
    {y: 0.78, radius: 0.44},
    {y: 1.0, radius: 0.04}
  ];
  for (const ring of rings) {
    for (let j = 0; j < radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      positions.push(x * ring.radius, ring.y, z * ring.radius);
      normals.push(x, 0.2, z);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const ring = i * radialSegments;
    const nextRing = (i + 1) * radialSegments;
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const a = ring + j;
      const b = ring + nextJ;
      const c = nextRing + j;
      const d = nextRing + nextJ;
      indices.push(a, c, b, b, c, d);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

function resolveAfterburnerConfig(config: AircraftControllerConfig, exhaustConfig: {afterburner?: boolean | AircraftAfterburnerConfig} | null | undefined): AircraftAfterburnerConfig | null {
  const afterburner = config.afterburner ?? exhaustConfig?.afterburner;
  if (!afterburner) {
    return null;
  }
  if (afterburner === true) {
    return {};
  }
  if (typeof afterburner === "object" && afterburner.enabled !== false) {
    return afterburner;
  }
  return null;
}

function hiddenExhaustMatrix(): Mat4 {
  return [
    0.0001, 0, 0, 0,
    0, 0.0001, 0, 0,
    0, 0, 0.0001, 0,
    0, 0, -100000, 1
  ] as Mat4;
}

function unwrapResult<T>(result: {ok: boolean; value?: T; error?: unknown}): T {
  if (!result.ok) {
    throw result.error;
  }
  return result.value as T;
}
