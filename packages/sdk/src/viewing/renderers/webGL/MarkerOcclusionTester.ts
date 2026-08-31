import {SDKErrorType, type SDKResult} from "../../../base/core";
import {type Mat4, transformVec4} from "../../../base/math/matrix";
import {
  createVec2Float64,
  createVec3Float64,
  createVec4Float64,
  dotVec3,
  lenVec3,
  normalizeVec3,
  subVec3,
  type Vec2,
  type Vec3,
  type Vec3Float
} from "../../../base/math/vector";
import {SceneRaycaster} from "../../../spatial/collision";
import type {SceneRaycastResult} from "../../../spatial/collision/SceneRaycastResult";
import type {View} from "../../viewer";
import {getElementCssSize} from "../../viewer/getElementCssSize";
import type {
  MarkerOcclusionMarker,
  MarkerOcclusionTesterParams
} from "./MarkerOcclusionTesterParams";
import type {MarkerOcclusionResult} from "./MarkerOcclusionResult";

/**
 * Minimal raycaster contract used by {@link MarkerOcclusionTester}.
 *
 * Applications normally do not need to provide this; it exists so tests and
 * advanced hosts can share or substitute a SceneRaycaster-compatible backend.
 */
export interface MarkerOcclusionRaycaster {
  pick(params: {
    view: View;
    ray: { origin: Vec3; dir: Vec3 };
    tMin: number;
    tMax: number;
    filter: (objectId: string) => boolean;
    visiblePickableOnly: false;
  }): SDKResult<SceneRaycastResult>;
}

/**
 * Constructor configuration for {@link MarkerOcclusionTester}.
 *
 * Prefer {@link WebGLRenderer.createMarkerOcclusionTester} when constructing
 * from application code; it validates that the View belongs to the renderer.
 */
export interface MarkerOcclusionTesterConfig {
  view: View;
  params?: MarkerOcclusionTesterParams;
  raycaster?: MarkerOcclusionRaycaster;
}

interface ProjectedMarker {
  inFrustum: boolean;
  canvasPos: Vec2 | null;
}

interface OcclusionRay {
  origin: Vec3Float;
  dir: Vec3Float;
  distanceToMarker: number;
}

interface MarkerHistory {
  visible: boolean;
  visibleFrames: number;
  occludedFrames: number;
}

const DEFAULT_DEPTH_BIAS = 0.01;
const DEFAULT_HIDE_DELAY_FRAMES = 2;
const DEFAULT_SHOW_DELAY_FRAMES = 1;
const DEFAULT_MAX_RAYCAST_STEPS = 32;
const RAYCAST_STEP_EPSILON = 1e-5;

const tempWorld = createVec4Float64();
const tempView = createVec4Float64();
const tempClip = createVec4Float64();
const tempScreen = createVec3Float64();
const tempViewPos = createVec3Float64();
const tempNear = createVec3Float64();
const tempFar = createVec3Float64();
const tempMarkerDelta = createVec3Float64();

/**
 * Tests whether world-space marker anchors are hidden by rendered scene
 * geometry in a {@link View}.
 *
 * The first backend is BVH-based: each marker is projected into canvas space,
 * converted to a camera ray, then checked against the scene triangle BVH up to
 * the marker distance. The API is intentionally stateful so floating annotation
 * UIs can reuse one tester per view and update all markers as a batch.
 */
export class MarkerOcclusionTester {

  readonly view: View;

  /** Resolved backend used by this tester. */
  readonly mode: "bvh" = "bvh";

  private readonly _raycaster: MarkerOcclusionRaycaster;
  private readonly _params: Required<Omit<MarkerOcclusionTesterParams,
    "mode" | "excludeObjectIds" | "occluderFilter">> & Pick<MarkerOcclusionTesterParams,
    "excludeObjectIds" | "occluderFilter">;
  private readonly _globalExcludeObjectIds: Set<string>;
  private readonly _excludeStyleBinIds: readonly string[];
  private readonly _history = new Map<string, MarkerHistory>();
  private _markers: MarkerOcclusionMarker[] = [];
  private _results: MarkerOcclusionResult[] = [];
  private _destroyed = false;

  constructor(config: MarkerOcclusionTesterConfig) {
    this.view = config.view;
    this._raycaster = config.raycaster ?? new SceneRaycaster(config.view.viewer.scene);
    const params = config.params ?? {};
    this._params = {
      depthBias: finiteNumber(params.depthBias, DEFAULT_DEPTH_BIAS),
      includeTransparent: params.includeTransparent === true,
      excludeStyleBinIds: params.excludeStyleBinIds ?? [],
      respectSectionPlanes: params.respectSectionPlanes !== false,
      hideDelayFrames: nonNegativeInteger(params.hideDelayFrames, DEFAULT_HIDE_DELAY_FRAMES),
      showDelayFrames: nonNegativeInteger(params.showDelayFrames, DEFAULT_SHOW_DELAY_FRAMES),
      maxRaycastSteps: Math.max(1, nonNegativeInteger(params.maxRaycastSteps, DEFAULT_MAX_RAYCAST_STEPS)),
      excludeObjectIds: params.excludeObjectIds,
      occluderFilter: params.occluderFilter
    };
    this._globalExcludeObjectIds = new Set(params.excludeObjectIds ?? []);
    this._excludeStyleBinIds = params.excludeStyleBinIds ?? [];
  }

  /**
   * Replaces the marker set tested by subsequent {@link update} calls.
   */
  setMarkers(markers: readonly MarkerOcclusionMarker[]): SDKResult<void> {
    if (this._destroyed) {
      return destroyedResult("[MarkerOcclusionTester.setMarkers]");
    }
    const validation = validateMarkers(markers);
    if (validation.ok === false) {
      return validation;
    }
    this._markers = markers.slice();
    for (const id of Array.from(this._history.keys())) {
      if (!this._markers.some((marker) => marker.id === id)) {
        this._history.delete(id);
      }
    }
    return {ok: true, value: undefined};
  }

  /**
   * Tests every marker and returns the latest visibility results.
   *
   * Passing `markers` is equivalent to calling {@link setMarkers} first.
   */
  update(markers?: readonly MarkerOcclusionMarker[]): SDKResult<readonly MarkerOcclusionResult[]> {
    if (this._destroyed) {
      return destroyedResult("[MarkerOcclusionTester.update]");
    }
    if (markers) {
      const setResult = this.setMarkers(markers);
      if (setResult.ok === false) {
        return setResult;
      }
    }

    const results: MarkerOcclusionResult[] = [];
    for (let i = 0, len = this._markers.length; i < len; i++) {
      results.push(this._testMarker(this._markers[i]));
    }
    this._results = results;
    return {ok: true, value: this._results};
  }

  /**
   * Returns the latest completed result set. Empty until {@link update} runs.
   */
  getVisibility(): readonly MarkerOcclusionResult[] {
    return this._results;
  }

  /**
   * Releases references held by this tester.
   */
  destroy(): void {
    this._destroyed = true;
    this._markers = [];
    this._results = [];
    this._history.clear();
  }

  private _testMarker(marker: MarkerOcclusionMarker): MarkerOcclusionResult {
    const projected = this._project(marker.worldPos);
    if (!projected.inFrustum || !projected.canvasPos) {
      this._history.set(marker.id, {visible: false, visibleFrames: 0, occludedFrames: 0});
      return this._makeResult(marker, projected, null, false, null);
    }

    const ray = this._makeRay(projected.canvasPos, marker.worldPos);
    if (!ray || ray.distanceToMarker <= this._params.depthBias) {
      this._history.set(marker.id, {visible: false, visibleFrames: 0, occludedFrames: 0});
      return this._makeResult(marker, projected, ray, false, null);
    }

    const hit = this._raycast(marker, ray);
    const occluded = hit !== null;
    this._applyHysteresis(marker.id, !occluded);
    return this._makeResult(marker, projected, ray, occluded, hit);
  }

  private _project(worldPos: Vec3): ProjectedMarker {
    tempWorld[0] = worldPos[0];
    tempWorld[1] = worldPos[1];
    tempWorld[2] = worldPos[2];
    tempWorld[3] = 1;

    transformVec4(this.view.camera.viewMatrix as Mat4, tempWorld, tempView);
    transformVec4(this.view.camera.projMatrix as Mat4, tempView, tempClip);

    const w = tempClip[3];
    if (!Number.isFinite(w) || Math.abs(w) < 1e-12) {
      return {inFrustum: false, canvasPos: null};
    }

    const ndcX = tempClip[0] / w;
    const ndcY = tempClip[1] / w;
    const ndcZ = tempClip[2] / w;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || !Number.isFinite(ndcZ)) {
      return {inFrustum: false, canvasPos: null};
    }

    const cssSize = getElementCssSize(this.view.htmlElement);
    const canvasPos = createVec2Float64();
    canvasPos[0] = (ndcX + 1) * 0.5 * cssSize.width;
    canvasPos[1] = (1 - ndcY) * 0.5 * cssSize.height;

    return {
      inFrustum: ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1 && ndcZ >= -1 && ndcZ <= 1,
      canvasPos
    };
  }

  private _makeRay(canvasPos: Vec2, markerWorldPos: Vec3): OcclusionRay | null {
    const projection = this.view.camera.projection;

    projection.unproject(canvasPos, -1, tempScreen, tempViewPos, tempNear);
    projection.unproject(canvasPos, 1, tempScreen, tempViewPos, tempFar);

    const dir = createVec3Float64();
    subVec3(tempFar, tempNear, dir);
    const dirLen = lenVec3(dir);
    if (!Number.isFinite(dirLen) || dirLen <= 1e-12) {
      return null;
    }
    normalizeVec3(dir, dir);

    subVec3(markerWorldPos, tempNear, tempMarkerDelta);
    const distanceToMarker = dotVec3(tempMarkerDelta, dir);
    if (!Number.isFinite(distanceToMarker)) {
      return null;
    }

    return {
      origin: createVec3Float64(tempNear),
      dir,
      distanceToMarker
    };
  }

  private _raycast(marker: MarkerOcclusionMarker, ray: OcclusionRay): SceneRaycastResult | null {
    let tMin = RAYCAST_STEP_EPSILON;
    const tMax = Math.max(tMin, ray.distanceToMarker - this._params.depthBias);
    const filter = (objectId: string) => this._acceptsOccluder(marker, objectId);

    for (let step = 0; step < this._params.maxRaycastSteps && tMin < tMax; step++) {
      const result = this._raycaster.pick({
        view: this.view,
        ray: {origin: ray.origin, dir: ray.dir},
        tMin,
        tMax,
        filter,
        visiblePickableOnly: false
      });
      if (result.ok === false || !result.value.hit) {
        return null;
      }
      if (!this._isHitClipped(result.value)) {
        return result.value;
      }
      tMin = (result.value.tHit ?? tMin) + RAYCAST_STEP_EPSILON;
    }
    return null;
  }

  private _acceptsOccluder(marker: MarkerOcclusionMarker, objectId: string): boolean {
    if (this._globalExcludeObjectIds.has(objectId)) {
      return false;
    }
    if (marker.excludeObjectIds?.includes(objectId)) {
      return false;
    }
    const viewObject = this.view.objects[objectId];
    if (!viewObject || !viewObject.visible || viewObject.culled) {
      return false;
    }
    for (let i = 0, len = this._excludeStyleBinIds.length; i < len; i++) {
      if (viewObject.hasStyleBin(this._excludeStyleBinIds[i])) {
        return false;
      }
    }
    if (!this._params.includeTransparent && viewObject.opacityUpdated && viewObject.opacity < 1) {
      return false;
    }
    if (marker.occluderFilter && !marker.occluderFilter(objectId)) {
      return false;
    }
    if (this._params.occluderFilter && !this._params.occluderFilter(objectId, marker)) {
      return false;
    }
    return true;
  }

  private _isHitClipped(hit: SceneRaycastResult): boolean {
    if (!this._params.respectSectionPlanes || !hit.worldPos || !hit.objectId) {
      return false;
    }
    const viewObject = this.view.objects[hit.objectId];
    if (!viewObject?.clippable) {
      return false;
    }
    const planes = this.view.sectionPlanes;
    for (const id in planes) {
      const plane = planes[id];
      if (!plane.active) {
        continue;
      }
      if (dotVec3(plane.dir, hit.worldPos) + plane.dist > 0) {
        return true;
      }
    }
    return false;
  }

  private _applyHysteresis(markerId: string, candidateVisible: boolean): boolean {
    const prev = this._history.get(markerId);
    if (!prev) {
      const next = {
        visible: candidateVisible,
        visibleFrames: candidateVisible ? 1 : 0,
        occludedFrames: candidateVisible ? 0 : 1
      };
      this._history.set(markerId, next);
      return next.visible;
    }

    let visible = prev.visible;
    let visibleFrames = prev.visibleFrames;
    let occludedFrames = prev.occludedFrames;

    if (candidateVisible) {
      visibleFrames++;
      occludedFrames = 0;
      if (!visible && visibleFrames >= this._params.showDelayFrames) {
        visible = true;
      }
    } else {
      occludedFrames++;
      visibleFrames = 0;
      if (visible && occludedFrames >= this._params.hideDelayFrames) {
        visible = false;
      }
    }

    this._history.set(markerId, {visible, visibleFrames, occludedFrames});
    return visible;
  }

  private _makeResult(
    marker: MarkerOcclusionMarker,
    projected: ProjectedMarker,
    ray: OcclusionRay | null,
    occluded: boolean,
    hit: SceneRaycastResult | null
  ): MarkerOcclusionResult {
    const history = this._history.get(marker.id);
    return {
      markerId: marker.id,
      marker,
      mode: this.mode,
      visible: !!history?.visible,
      occluded,
      inFrustum: projected.inFrustum,
      canvasPos: projected.canvasPos,
      rayOrigin: ray ? createVec3Float64(ray.origin) : null,
      rayDir: ray ? createVec3Float64(ray.dir) : null,
      distanceToMarker: ray ? ray.distanceToMarker : null,
      occluderObjectId: hit?.objectId ?? null,
      occluderMeshId: hit?.meshId ?? null
    };
  }
}

function validateMarkers(markers: readonly MarkerOcclusionMarker[]): SDKResult<void> {
  const ids = new Set<string>();
  for (let i = 0, len = markers.length; i < len; i++) {
    const marker = markers[i];
    if (!marker || !marker.id) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MarkerOcclusionTester.setMarkers] Marker at index ${i} has no id.`
      };
    }
    if (ids.has(marker.id)) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MarkerOcclusionTester.setMarkers] Duplicate marker id: ${marker.id}`
      };
    }
    ids.add(marker.id);
    if (!marker.worldPos || marker.worldPos.length < 3 ||
      !Number.isFinite(marker.worldPos[0]) ||
      !Number.isFinite(marker.worldPos[1]) ||
      !Number.isFinite(marker.worldPos[2])) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[MarkerOcclusionTester.setMarkers] Marker '${marker.id}' has an invalid worldPos.`
      };
    }
  }
  return {ok: true, value: undefined};
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value as number : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : fallback;
}

function destroyedResult(prefix: string): SDKResult<any> {
  return {
    ok: false,
    type: SDKErrorType.InvalidOperation,
    error: `${prefix} MarkerOcclusionTester has been destroyed.`
  };
}
