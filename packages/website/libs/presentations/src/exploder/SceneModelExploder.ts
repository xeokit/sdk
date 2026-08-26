import type {SceneModelExploderParams} from "./SceneModelExploderParams";


/**
 * Cached per-mesh "rest pose" snapshot taken at {@link SceneModelExploder.rebuild}
 * time, plus the mesh's centre in scene-space (used as the radial direction
 * away from the model centre during explode).
 *
 * @internal
 */
type ExplodeMeshState = {
  mesh: any;
  centerInScene: number[];
  baseMatrix: number[];
};

/**
 * Cached scene-space model centre + per-mesh state. Reused across every
 * `setFactor` call until {@link SceneModelExploder.rebuild} replaces it.
 *
 * @internal
 */
type ExplodeState = {
  modelCenterInScene: number[];
  meshes: ExplodeMeshState[];
};


export class SceneModelExploder {
  private scene: any;
  private sceneModel: any;
  private collisionIndex: any;
  private _factor: number;
  private _state: ExplodeState | null;

  private _sliderContainer: HTMLDivElement | null;
  private _sliderElement: HTMLInputElement | null;

  private _minFactor: number;
  private _maxFactor: number;
  private _step: number;

  constructor(params: SceneModelExploderParams) {
    this.scene = params.scene;
    this.sceneModel = params.sceneModel;
    this.collisionIndex = params.collisionIndex;

    this._minFactor = params.minFactor ?? 0;
    this._maxFactor = params.maxFactor ?? 2;
    this._step = params.step ?? 0.05;

    this._factor = params.initialFactor ?? 0;
    this._state = null;

    this._sliderContainer = null;
    this._sliderElement = null;

    this._createSliderControl();

    if (this._factor !== 0) {
      this.setFactor(this._factor);
    }
  }

  get factor(): number {
    return this._factor;
  }

  set factor(value: number) {
    this.setFactor(value);
  }

  /**
   * Rebuilds cached explode state from the current SceneModel.
   */
  rebuild(): this {
    const meshes = this.collectSceneMeshes(this.sceneModel);

    let modelAABB: number[] | null = null;

    for (const mesh of meshes) {
      const meshAABB = this.collisionIndex.getMeshAABB(mesh);
      if (meshAABB) {
        modelAABB = this.expandAABB(modelAABB, meshAABB);
      }
    }

    const modelCenterInScene = modelAABB ? this.getCenter(modelAABB) : [0, 0, 0];

    this._state = {
      modelCenterInScene,
      meshes: meshes.map((mesh: any) => ({
        mesh,
        centerInScene: this.getCenter(this.collisionIndex.getMeshAABB(mesh)),
        baseMatrix: this.cloneMat4(mesh.matrix)
      }))
    };

    return this;
  }

  /**
   * Applies explode offset away from the SceneModel center.
   */
  setFactor(factor: number): this {
    if (!this._state) {
      this.rebuild();
    }

    this._factor = factor;

    if (this._sliderElement && Number(this._sliderElement.value) !== factor) {
      this._sliderElement.value = String(factor);
    }

    const state = this._state;
    if (!state) {
      return this;
    }

    const sceneCoordSystem = this.scene.coordinateSystem;
    const modelCoordSystem = this.sceneModel.coordinateSystem;

    for (const item of state.meshes) {
      const {mesh, centerInScene, baseMatrix} = item;

      const explodeVectorInScene = this.subVec3(centerInScene, state.modelCenterInScene);

      const explodeVectorInModelLocal = this.sceneVectorToModelLocalVector(
        explodeVectorInScene,
        sceneCoordSystem,
        modelCoordSystem
      );

      const nextMatrix = this.cloneMat4(baseMatrix);

      nextMatrix[12] = baseMatrix[12] + (explodeVectorInModelLocal[0] * factor);
      nextMatrix[13] = baseMatrix[13] + (explodeVectorInModelLocal[1] * factor);
      nextMatrix[14] = baseMatrix[14] + (explodeVectorInModelLocal[2] * factor);

      mesh.matrix = nextMatrix;
    }

    return this;
  }

  reset(): this {
    return this.setFactor(0);
  }

  destroy(): void {
    this.reset();
    this._state = null;

    if (this._sliderContainer && this._sliderContainer.parentElement) {
      this._sliderContainer.parentElement.removeChild(this._sliderContainer);
    }

    this._sliderContainer = null;
    this._sliderElement = null;
  }

  private _createSliderControl(): void {
    const sliderContainer = document.createElement("div");
    sliderContainer.style.position = "absolute";
    sliderContainer.style.right = "12px";
    sliderContainer.style.top = "65px";
    sliderContainer.style.zIndex = "100000";
    sliderContainer.style.padding = "10px 12px";
    sliderContainer.style.background = "rgba(255,255,255,0.85)";
    sliderContainer.style.fontFamily = "sans-serif";
    sliderContainer.style.fontSize = "14px";
    sliderContainer.style.borderRadius = "4px";

    const title = document.createElement("div");
    title.textContent = "Explode";
    title.style.marginBottom = "8px";
    title.style.fontWeight = "bold";
    sliderContainer.appendChild(title);

    const label = document.createElement("label");
    label.textContent = "Explode factor";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(this._minFactor);
    slider.max = String(this._maxFactor);
    slider.step = String(this._step);
    slider.value = String(this._factor);
    slider.style.marginLeft = "8px";

    slider.addEventListener("input", () => {
      this.setFactor(Number(slider.value));
    });

    label.appendChild(slider);
    sliderContainer.appendChild(label);
    document.body.appendChild(sliderContainer);

    this._sliderContainer = sliderContainer;
    this._sliderElement = slider;
  }

  private getCenter(aabb: number[]): number[] {
    return [
      (aabb[0] + aabb[3]) / 2,
      (aabb[1] + aabb[4]) / 2,
      (aabb[2] + aabb[5]) / 2
    ];
  }

  private cloneMat4(m: ArrayLike<number>): number[] {
    return [
      m[0],  m[1],  m[2],  m[3],
      m[4],  m[5],  m[6],  m[7],
      m[8],  m[9],  m[10], m[11],
      m[12], m[13], m[14], m[15]
    ];
  }

  private collectSceneMeshes(sceneModel: any): any[] {
    if (Array.isArray(sceneModel.meshes)) {
      return sceneModel.meshes;
    }
    if (sceneModel.meshes instanceof Map) {
      return Array.from(sceneModel.meshes.values());
    }
    if (sceneModel.meshes && typeof sceneModel.meshes === "object") {
      return Object.values(sceneModel.meshes);
    }
    return [];
  }

  private expandAABB(dest: number[] | null, src: number[]): number[] {
    if (!dest) {
      return [src[0], src[1], src[2], src[3], src[4], src[5]];
    }

    dest[0] = Math.min(dest[0], src[0]);
    dest[1] = Math.min(dest[1], src[1]);
    dest[2] = Math.min(dest[2], src[2]);
    dest[3] = Math.max(dest[3], src[3]);
    dest[4] = Math.max(dest[4], src[4]);
    dest[5] = Math.max(dest[5], src[5]);

    return dest;
  }

  private dotVec3(a: ArrayLike<number>, b: ArrayLike<number>): number {
    return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
  }

  private subVec3(a: ArrayLike<number>, b: ArrayLike<number>): number[] {
    return [
      a[0] - b[0],
      a[1] - b[1],
      a[2] - b[2]
    ];
  }

  private addScaledVec3(a: ArrayLike<number>, b: ArrayLike<number>, s: number): number[] {
    return [
      a[0] + (b[0] * s),
      a[1] + (b[1] * s),
      a[2] + (b[2] * s)
    ];
  }

  /**
   * Converts a translation vector expressed in Scene coordinate axes/units
   * into a translation vector suitable for SceneMesh.matrix, which is in
   * SceneModel local coordinate axes/units.
   */
  private sceneVectorToModelLocalVector(
    sceneVector: ArrayLike<number>,
    sceneCoordSystem: any,
    modelCoordSystem: any
  ): number[] {
    const sceneRightComp = this.dotVec3(sceneVector, sceneCoordSystem.worldRight);
    const sceneUpComp = this.dotVec3(sceneVector, sceneCoordSystem.worldUp);
    const sceneForwardComp = this.dotVec3(sceneVector, sceneCoordSystem.worldForward);

    let modelLocalVector = [0, 0, 0];

    modelLocalVector = this.addScaledVec3(modelLocalVector, modelCoordSystem.worldRight, sceneRightComp);
    modelLocalVector = this.addScaledVec3(modelLocalVector, modelCoordSystem.worldUp, sceneUpComp);
    modelLocalVector = this.addScaledVec3(modelLocalVector, modelCoordSystem.worldForward, sceneForwardComp);

    return modelLocalVector;
  }
}
