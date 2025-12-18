import type {ViewObject} from "./ViewObject";
import {SceneMesh, SceneObject} from "../scene";
import {View} from "./View";
import {createVec2Int32, createVec2Float64, createVec3Float64, type Vec2, type Vec3} from "../matrix";


/**
 * Results of a pick attempted with {@link View.pick}.
 */
class PickResult {

  #sceneMesh: SceneMesh;
  #sceneObject: SceneObject;
  #view: View;
  #viewObject?: ViewObject | null | undefined;
  #gotCanvasPos: boolean;
  #gotSnappedCanvasPos: boolean;
  #gotOrigin: boolean;
  #gotDirection: boolean;
  #gotIndices: boolean;
  #gotLocalPos: boolean;
  #gotWorldPos: boolean;
  #gotViewPos: boolean;
  #gotWorldNormal: boolean;
  #gotUV: boolean;
  #snappedToVertex: boolean;
  #snappedToEdge: boolean;
  #canvasPos: Vec2
  #snappedCanvasPos: Vec2;
  #origin: Vec3;
  #direction: Vec3;
  #indices: Int32Array<any>;
  #localPos: Vec3;
  #worldPos: Vec3;
  #viewPos: Vec3;
  #worldNormal: Vec3;
  #uv: Vec2;

  constructor() {

    this.#sceneMesh = null as any;
    this.#sceneObject = null as any;
    this.#view = null as any;
    this.#viewObject = null;
    this.#canvasPos = createVec2Int32();
    this.#origin = createVec3Float64();
    this.#direction = createVec3Float64();
    this.#indices = new Int32Array(3);
    this.#localPos = createVec3Float64();
    this.#worldPos = createVec3Float64();
    this.#viewPos = createVec3Float64();
    this.#worldNormal = createVec3Float64();
    this.#uv = createVec2Float64();
    this.#gotOrigin = false;
    this.#gotDirection = false;
    this.#gotIndices = false;
    this.#gotCanvasPos = false;
    this.#gotSnappedCanvasPos = false;
    this.#gotLocalPos = false;
    this.#gotWorldPos = false;
    this.#gotViewPos = false;
    this.#gotWorldNormal = false;
    this.#gotUV = false;
    this.#snappedToVertex = false
    this.#snappedToEdge = false;

    this.reset();
  }


  /**
   * The picked {@link View}.
   */
  get view(): View | null | undefined {
    return this.#view;
  }

  /**
   * @private
   */
  set view(value: View | null | undefined) {
    this.#view = value;
  }

  /**
   * The picked {@link SceneObject}.
   */
  get sceneObject(): SceneObject | null | undefined {
    return this.#sceneObject;
  }

  /**
   * @private
   */
  set sceneObject(value: SceneObject | null | undefined) {
    this.#sceneObject = value;
  }

  /**
   * The picked {@link SceneMesh}.
   */
  get sceneMesh(): SceneMesh | null | undefined {
    return this.#sceneMesh;
  }

  /**
   * @private
   */
  set sceneMesh(value: SceneMesh | null | undefined) {
    this.#sceneMesh = value;
  }

  /**
   * The picked {@link ViewObject}.
   */
  get viewObject(): ViewObject | null | undefined {
    return this.#viewObject;
  }

  /**
   * @private
   */
  set viewObject(value: ViewObject | null | undefined) {
    this.#viewObject = value;
  }

  /**
   * Canvas coordinates when picking with a 2D pointer.
   */
  get canvasPos(): Vec2 {
    return this.#gotCanvasPos ? this.#canvasPos : undefined;
  }

  /**
   * @private
   */
  set canvasPos(value: Vec2 | undefined) {
    if (value) {
      this.#canvasPos[0] = value[0];
      this.#canvasPos[1] = value[1];
      this.#gotCanvasPos = true;
    } else {
      this.#gotCanvasPos = false;
    }
  }

  /**
   * World-space 3D ray origin when raypicked.
   */
  get origin(): Vec3 | null {
    return this.#gotOrigin ? this.#origin : null;
  }

  /**
   * @private
   */
  set origin(value: any) {
    if (value) {
      this.#origin[0] = value[0];
      this.#origin[1] = value[1];
      this.#origin[2] = value[2];
      this.#gotOrigin = true;
    } else {
      this.#gotOrigin = false;
    }
  }

  /**
   * World-space 3D ray direction when raypicked.
   */
  get direction(): Vec3 | null {
    return this.#gotDirection ? this.#direction : null;
  }

  /**
   * @private
   */
  set direction(value: any) {
    if (value) {
      this.#direction[0] = value[0];
      this.#direction[1] = value[1];
      this.#direction[2] = value[2];
      this.#gotDirection = true;
    } else {
      this.#gotDirection = false;
    }
  }

  /**
   * Picked triangle's vertex indices.
   * Only defined when an object and triangle was picked.
   */
  get indices(): Int32Array<any> | null {
    return this.#viewObject !== null && this.#gotIndices ? this.#indices : null;
  }

  /**
   * @private
   */
  set indices(value: any) {
    if (value) {
      this.#indices[0] = value[0];
      this.#indices[1] = value[1];
      this.#indices[2] = value[2];
      this.#gotIndices = true;
    } else {
      this.#gotIndices = false;
    }
  }

  /**
   * Picked Local-space point on surface.
   * Only defined when an object and a point on its surface was picked.
   */
  get localPos(): Vec3 | null {
    return this.#viewObject !== null && this.#gotLocalPos ? this.#localPos : null;
  }

  /**
   * @private
   */
  set localPos(value: any) {
    if (value) {
      this.#localPos[0] = value[0];
      this.#localPos[1] = value[1];
      this.#localPos[2] = value[2];
      this.#gotLocalPos = true;
    } else {
      this.#gotLocalPos = false;
    }
  }

  /**
   * Picked World-space point on surface.
   * Only defined when an object and a point on its surface was picked.
   */
  get worldPos(): Vec3 | null {
    return this.#viewObject && this.#gotWorldPos ? this.#worldPos : null;
  }

  /**
   * @private
   */
  set worldPos(value: any) {
    if (value) {
      this.#worldPos[0] = value[0];
      this.#worldPos[1] = value[1];
      this.#worldPos[2] = value[2];
      this.#gotWorldPos = true;
    } else {
      this.#gotWorldPos = false;
    }
  }

  /**
   * Picked View-space point on surface.
   * Only defined when an object and a point on its surface was picked.
   */
  get viewPos(): Vec3 | null {
    return this.#viewObject && this.#gotViewPos ? this.#viewPos : null;
  }

  /**
   * @private
   */
  set viewPos(value: any) {
    if (value) {
      this.#viewPos[0] = value[0];
      this.#viewPos[1] = value[1];
      this.#viewPos[2] = value[2];
      this.#gotViewPos = true;
    } else {
      this.#gotViewPos = false;
    }
  }

  /**
   * Normal vector at picked position on surface.
   * Only defined when an object and a point on its surface was picked.
   */
  get worldNormal(): Vec3 | null {
    return this.#viewObject !== null && this.#gotWorldNormal ? this.#worldNormal : null;
  }

  /**
   * @private
   */
  set worldNormal(value: any) {
    if (value) {
      this.#worldNormal[0] = value[0];
      this.#worldNormal[1] = value[1];
      this.#worldNormal[2] = value[2];
      this.#gotWorldNormal = true;
    } else {
      this.#gotWorldNormal = false;
    }
  }

  /**
   * UV coordinates at picked position on surface.
   * Only defined when an object and a point on its surface was picked.
   */
  get uv(): Vec2 | null {
    return this.#viewObject !== null && this.#gotUV ? this.#uv : null;
  }

  /**
   * @private
   */
  set uv(value: any) {
    if (value) {
      this.#uv[0] = value[0];
      this.#uv[1] = value[1];
      this.#gotUV = true;
    } else {
      this.#gotUV = false;
    }
  }

  /**
   * Returns `true` if picking has snapped to the canvas coordinates of the nearest vertex.
   * When this is `true`, then {@link PickResult.snappedCanvasPos} will contain the canvas coordinates of the nearest position on teh nearest vertex.
   */
  get snappedToVertex(): boolean {
    return this.#viewObject !== null && this.#snappedToVertex;
  }

  /**
   * @private
   */
  set snappedToVertex(value: boolean) {
    this.#snappedToVertex = value;
  }

  /**
   * Returns `true` if picking has snapped to the canvas coordinates of the nearest edge.
   * When this is `true`, then {@link PickResult.snappedCanvasPos} will contain the canvas coordinates of the nearest position on teh nearest edge.
   */
  get snappedToEdge(): boolean {
    return this.#viewObject !== null && this.#snappedToEdge;
  }

  set snappedToEdge(value: boolean) {
    this.#snappedToEdge = value;
  }

  /**
   * Snapped canvas coordinates when picking with a 2D pointer.
   * This has a value when {@link PickResult.snappedToEdge} or {@link PickResult.snappedToVertex} is `true`, otherwise will be `null`.
   */
  get snappedCanvasPos(): Vec2 | undefined {
    return this.#gotSnappedCanvasPos ? this.#snappedCanvasPos : undefined;
  }

  /**
   * @private
   */
  set snappedCanvasPos(value: Vec2 | undefined) {
    if (value) {
      this.#snappedCanvasPos[0] = value[0];
      this.#snappedCanvasPos[1] = value[1];
      this.#gotSnappedCanvasPos = true;
    } else {
      this.#gotSnappedCanvasPos = false;
    }
  }

  /**
   * @private
   */
  reset() {
    this.#sceneMesh = null;
    this.#sceneObject = null;
    this.#view = null;
    this.#viewObject = null;
    this.#gotCanvasPos = false;
    this.#gotSnappedCanvasPos = false;
    this.#gotOrigin = false;
    this.#gotDirection = false;
    this.#gotIndices = false;
    this.#gotLocalPos = false;
    this.#gotWorldPos = false;
    this.#gotViewPos = false;
    this.#gotWorldNormal = false;
    this.#gotUV = false;
    this.#snappedToVertex = false;
    this.#snappedToEdge = false;
  }
}

export {PickResult};
