import {createMat4, createVec3} from "../matrix";
import {createRTCViewMat, worldToRTCCenter} from "../rtc";
import type {FloatArrayParam} from "../math";
import {WebGLDataTexture} from "../webglutils";
import {WebGLRenderer} from "./WebGLRenderer";
import {View, Viewer} from "../viewer";

const NUM_VIEWS = 4;
const NUM_MATRICES = 2000;

const tempVec3a = createVec3();

/**
 * A Matrix within a WebGLMatrixManager.
 *
 * @internal
 */
export interface Matrix {

  /**
   * Index of this Matrix within the WebGLMatrixManager
   */
  index: number;

  /**
   *
   */
  matrix: FloatArrayParam;
}

/**
 * Manages view matrices for a matrixd coordinate system.
 *
 * @internal
 */
export class WebGLMatrixManager {

  #viewer: Viewer;
  #matrixIndexesUsed: boolean[];
  #matrices: {};
  #lastFreeMatrixIndex: number;
  #numMatrices: number;
  #webglRenderer: WebGLRenderer;

  #onViewCreated: () => void;
  #onViewDestroyed: () => void;

  #onCameraViewMatrix: (()=>void)[];

  /**
   * A data texture for each View, containing an RTC view matrix for each Matrix.
   * Each data texture gets updated with new matrices for each matrix each time its View's Camera moves.
   * This is indexed with View.viewIndex.
   */
  dataTextures: WebGLDataTexture[];

  /**
   * Creates a matrix manager for a Viewer and WebGLRenderer.
   * @param viewer
   * @param webGLRenderer
   */
  constructor(viewer: Viewer, webGLRenderer: WebGLRenderer) {

    this.#webglRenderer = webGLRenderer;

    this.#viewer = viewer;
    this.#matrixIndexesUsed = [];
    this.#lastFreeMatrixIndex = 0;
    this.#matrices = {};
    this.#numMatrices = 0;

    /**
     * A data texture per View, each holding an RTC View matrix for each matrix
     */
    this.dataTextures = [];

    this.#initDataTextures();

    this.#onCameraViewMatrix = [];

    for (let viewId in viewer.views) {
      const view = viewer.views[viewId];
      this.#attachView(view);
    }

    this.#onViewCreated = this.#viewer.onViewCreated.sub((viewer, view) => {
      this.#attachView(view);
    });

    this.#onViewDestroyed = this.#viewer.onViewDestroyed.sub((viewer, view) => {
      this.#detachView(view);
    });
  }

   #attachView(view: View) {
    this.#updateDataTextures(view);
    this.#onCameraViewMatrix[view.viewIndex] = view.camera.onViewMatrix.sub(() => {
      this.#updateDataTextures(view);
    });
  }

  #detachView(view: View) {
    const viewIndex = view.viewIndex;
    const dataTexture = this.dataTextures[viewIndex];
    if (dataTexture) {
      delete this.dataTextures[viewIndex];
      dataTexture.destroy();
    }
    view.camera.onViewMatrix.unsub(this.#onCameraViewMatrix[viewIndex]);
    delete this.#onCameraViewMatrix[viewIndex];
  }

  #initDataTextures() {
    const gl = this.#webglRenderer.gl;
    const textureWidth = 512 * 4; // In one row we can fit 512 matrices
    const textureHeight = Math.ceil(NUM_MATRICES / (textureWidth / 4));
    for (let i = 0; i < NUM_VIEWS; i++) {
      const textureData = new Float32Array(4 * textureWidth * textureHeight);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, textureWidth, textureHeight);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.FLOAT, textureData, 0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.dataTextures.push(new WebGLDataTexture({gl, texture, textureWidth, textureHeight, textureData}));
    }
  }

  #updateDataTextures(view: View) {
    const viewMatrix = view.camera.viewMatrix;
    const viewIndex = view.viewIndex;
    const matrixIds = Object.keys(this.#matrices);
    const numMatrices = matrixIds.length;
    if (numMatrices > 0) {
      const gl = this.#webglRenderer.gl;
      const data = new Float32Array(16 * numMatrices);
      for (let i = 0; i < numMatrices; i++) {
        const matrixId = matrixIds[i];
        const matrix = this.#matrices[matrixId];
        createRTCViewMat(viewMatrix, matrix.center, matrix.matrix[viewIndex]);
        data.set(<any>matrix.matrix[viewIndex], matrix.index * 16);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.dataTextures[viewIndex].texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.FLOAT, data);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  /**
   * Get a Matrix that contains the given 3D World-space position.
   * @param worldPos
   */
  getMatrix(values: FloatArrayParam): Matrix {
    const matrix = {
        index: this.#getFreeMatrixIndex(),
        matrix: createMat4()
      };
      this.#matrices[matrix.index] = matrix;
      this.#numMatrices++;
    return matrix;
  }

  /**
   * Releases a Matrix back to the matrix manager.
   * The Matrix is destroyed as soon as it is released as many times as it was got.
   * @param matrix
   */
  putMatrix(matrix: Matrix) {
      delete this.#matrices[matrix.index];
      this.#putFreeMatrixIndex(matrix.index);
      this.#numMatrices--;
  }

  /**
   * Update a Matrix.
   * @param matrix
   * @param values
   */
  updateMatrix(matrix: Matrix, values: FloatArrayParam): Matrix {
    return matrix
  }

  #getFreeMatrixIndex(): number {
    for (let matrixIndex = this.#lastFreeMatrixIndex; ; matrixIndex = (matrixIndex + 1) % NUM_MATRICES) {
      if (!this.#matrixIndexesUsed[matrixIndex]) {
        this.#matrixIndexesUsed[matrixIndex] = true;
        return matrixIndex;
      }
    }
  }

  #putFreeMatrixIndex(matrixIndex: number) {
    if (this.#matrixIndexesUsed[matrixIndex]) {
      delete this.#matrixIndexesUsed[matrixIndex];
      this.#lastFreeMatrixIndex = matrixIndex;
      this.#numMatrices--;
    }
  }

  /**
   * Destroys this matrix manager.
   */
  destroy() {

  }
}
