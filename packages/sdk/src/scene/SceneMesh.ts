import {createMat4, identityMat4, isIdentityMat4, mulMat4} from "../matrix";
import type {FloatArrayParam} from "../math";
import type {RendererMesh} from "./RendererMesh";
import type {SceneGeometry} from "./SceneGeometry";
import type {SceneMeshParams} from "./SceneMeshParams";
import type {SceneObject} from "./SceneObject";
import type {SceneTextureSet} from "./SceneTextureSet";
import {SceneModel} from "./SceneModel";

const tempMat4 = createMat4();

/**
 * A mesh in a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link SceneModel.createMesh | SceneModel.addMesh}
 * * Referenced by {@link SceneObject.meshes | SceneObject.meshes}
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export class SceneMesh {

  /**
   * Unique ID of this SceneMesh.
   *
   * SceneMesh is stored by this ID in {@link SceneModel.meshes}.
   */
  readonly id: string;

  /**
   * The SceneModel that contains this SceneMesh.
   */
  readonly model: SceneModel;

  /**
   * The {@link SceneObject} that uses this SceneMesh.
   */
  object: SceneObject|null;

  /**
   * {@link SceneGeometry} used by this SceneMesh.
   */
  readonly geometry: SceneGeometry;

  /**
   * {@link SceneTextureSet} used by this SceneMesh.
   */
  readonly textureSet?: SceneTextureSet;

  /**
   *  Internal interface through which a {@link SceneMesh} can load property updates into a renderer.
   *
   *  This is defined when the owner {@link SceneModel | SceneModel} has been added to
   *  a {@link viewer!Viewer | Viewer}.
   *
   * @internal
   */
  rendererMesh: RendererMesh|null;

  #color: FloatArrayParam;
  #matrix: FloatArrayParam;
  #opacity: number;

  /**
   * @private
   */
  constructor( meshParams: {
    id: string;
    model: SceneModel;
    geometry: SceneGeometry;
    textureSet?: SceneTextureSet;
    matrix?: FloatArrayParam;
    color?: FloatArrayParam;
    opacity?: number;
  } ) {
    this.id = meshParams.id;
    this.model = meshParams.model;
    this.#matrix = meshParams.matrix ? createMat4(meshParams.matrix) : identityMat4();
    this.geometry = meshParams.geometry;
    this.textureSet = meshParams.textureSet;
    this.rendererMesh = null;
    this.color = meshParams.color || new Float32Array([1, 1, 1]);
    this.opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? meshParams.opacity : 1.0;
  }

  /**
   * Gets the RGB color for this SceneMesh.
   *
   * Each element of the color is in range ````[0..1]````.
   */
  get color(): FloatArrayParam {
    return this.#color;
  }

  /**
   * Sets the RGB color for this SceneMesh.
   *
   * Each element of the color is in range ````[0..1]````.
   */
  set color( value: FloatArrayParam ) {
    let color = this.#color;
    if (!color) {
      color = this.#color = new Float32Array(4);
      color[3] = 1;
    }
    if (value) {
      color[0] = value[0];
      color[1] = value[1];
      color[2] = value[2];
    } else {
      color[0] = 1;
      color[1] = 1;
      color[2] = 1;
    }
    this.rendererMesh?.setColor(this.#color);
  }

  /**
   * Updates this SceneMesh's local modeling transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @type {FloatArrayParam}
   */
  set matrix( matrix: FloatArrayParam ) {
    if (matrix) {
      // @ts-ignore
      this.#matrix.set(matrix);
    } else {
      identityMat4(this.#matrix);
    }
    if (this.rendererMesh) {

      // TODO: recompute AABBs using coordinateSystemMatrix

      const coordSystemAndModelingMatrix = mulMat4(this.model.coordinateSystemMatrix, this.#matrix, tempMat4);
      this.rendererMesh.setMatrix(coordSystemAndModelingMatrix);
    }
    const scene = this.model.scene;
    scene.onMeshMoved.dispatch(scene, this);
  }

  /**
   * Gets this SceneMesh's local modeling transform matrix.
   *
   * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
   *
   * @type {FloatArrayParam}
   */
  get matrix(): FloatArrayParam {
    return this.#matrix;
  }

  /**
   * Gets the opacity factor for this SceneMesh.
   *
   * This is a factor in range ````[0..1]````.
   */
  get opacity(): number {
    return this.#opacity;
  }

  /**
   * Sets the opacity factor for this SceneMesh.
   *
   * This is a factor in range ````[0..1]````.
   */
  set opacity( opacity: number ) {
    opacity = (opacity !== undefined && opacity !== null) ? opacity : 1.0;
    if (this.#opacity === opacity) {
      return;
    }
    this.#opacity = opacity;
    if (this.rendererMesh) {
      //       this.rendererObject.setOpacity(this.#opacity);
    }
  }

  /**
   * Gets this SceneMesh as SceneMeshParams.
   */
  toParams(): SceneMeshParams {
    const meshParams = <SceneMeshParams>{
      id: this.id,
      geometryId: this.geometry.id,
      color: Array.from(this.#color),
      opacity: this.#opacity
    };
    if (!isIdentityMat4(this.#matrix)) {
      meshParams.matrix = Array.from(this.#matrix);
    }
    if (this.textureSet !== undefined) {
      meshParams.textureSetId = this.textureSet.id;
    }
    return meshParams;
  }

  /**
   * Destroys this SceneMesh.
   */
  destroy() {
    this.model._destroyMesh(this);
  }
}
