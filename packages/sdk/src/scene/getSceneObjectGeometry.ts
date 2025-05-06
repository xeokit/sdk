import {LinesPrimitive, TrianglesPrimitive} from "../constants";
import {decompressPositions3WithAABB3} from "../compression";
import type {FloatArrayParam} from "../math";
import type {SceneGeometry} from "./SceneGeometry";
import type {SceneMesh} from "./SceneMesh";
import type {SceneObject} from "./SceneObject";
import {transformPositions3} from "../matrix";

/**
 * The {@link getSceneObjectGeometry} passes an instance of GeometryView to its callback
 * for each {@link SceneGeometry} it visits.
 *
 * The GeometryView provides the SceneObject, SceneMesh and SceneGeometry at the current state
 * of iteration, along with accessors through which the caller can
 * get various resources that the GeometryView lazy-computes on-demand, such as decompressed vertex positions, World-space
 * vertex positons, and decompressed vertex UV coordinates.
 */
export interface GeometryView {

  /**
   * The current {@link SceneObject}.
   */
  object: SceneObject;

  /**
   * The current {@link SceneMesh}.
   */
  mesh: SceneMesh;

  /**
   * The current {@link SceneMesh | SceneMesh's} position in {@link SceneModel.meshes | SceneObject.meshes}.
   */
  meshIndex: number;

  /**
   * The current {@link SceneGeometry}.
   */
  geometry: SceneGeometry;

  /**
   * The number of primitives in the current {@link SceneGeometry}.
   */
  readonly numPrimitives: number;

  /**
   * The current 3D vertex positions, dequantized, as 32-bit floats.
   */
  readonly positionsDecompressed: FloatArrayParam;

  /**
   * The current 3D World-space vertex positions, dequantized and world-transformed, as 64-bit floats.
   */
  readonly positionsWorld: FloatArrayParam;

  /**
   * The current vertex UV coordinates, if any, dequantized to 32-bit floats.
   */
  readonly uvsDecompressed: FloatArrayParam;
}

class GeometryViewImpl {

  object: SceneObject | null;
  mesh: SceneMesh | null;
  meshIndex: number;
  geometry: SceneGeometry | null;

  #positionsDecompressed: Float32Array | null;
  #positionsWorld: Float64Array | null;

  constructor() {
    this.object = null;
    this.mesh = null;
    this.meshIndex = 0;
    this.geometry = null;
    this.#positionsDecompressed = null;
    this.#positionsWorld = null;
  }

  get numPrimitives() {
    const primitiveType = (<SceneGeometry>this.geometry).primitive;
    const elementsPerPrimitiveType = (primitiveType === TrianglesPrimitive ? 3 : (primitiveType === LinesPrimitive ? 2 : 1));
    return this.geometry.indices.length / elementsPerPrimitiveType;
  }

  get positionsDecompressed(): FloatArrayParam {
    if (!this.#positionsDecompressed) {
      this.#positionsDecompressed = new Float32Array((<SceneGeometry>this.geometry).positionsCompressed.length);
      decompressPositions3WithAABB3((<SceneGeometry>this.geometry).positionsCompressed, (<SceneGeometry>this.geometry).aabb, this.#positionsDecompressed);
    }
    return this.#positionsDecompressed;
  }

  get positionsWorld(): FloatArrayParam {
    if (!this.#positionsWorld) {
      const positionsDecompressed = this.positionsDecompressed;
      this.#positionsWorld = new Float64Array(positionsDecompressed.length);
      transformPositions3(positionsDecompressed, (<SceneMesh>this.mesh).matrix, this.#positionsWorld);
    }
    return this.#positionsWorld;
  }

  get uvsDecompressed(): FloatArrayParam | null {
    return null;
  }

  reset() {
    this.#positionsDecompressed = null;
    this.#positionsWorld = null;
  }
}

const geometryView = new GeometryViewImpl();

/**
 * Gets the uncompressed, World-space geometry of each {@link SceneGeometryBucket} in each
 * {@link SceneGeometry} in each {@link SceneMesh} in a {@link SceneObject}.
 *
 * If the callback returns ````true````, then this method immediately stops iterating and also returns ````true````.
 *
 * @param sceneObject
 * @param withEachGeometry
 */
export function getSceneObjectGeometry(sceneObject: SceneObject, withEachGeometry: (geometryView: GeometryView) => boolean): boolean {
  // geometryView.reset();
  // geometryView.object = sceneObject;
  // for (let i = 0, len = sceneObject.meshes.length; i < len; i++) {
  //     const mesh = sceneObject.meshes[i];
  //     geometryView.mesh = mesh;
  //     geometryView.meshIndex = i;
  //     const geometry = mesh.geometry;
  //     geometryView.geometry = geometry;
  //     for (let j = 0, lenj = geometry.geometryBuckets.length; j < lenj; j++) {
  //         geometryView.geometryBucket = geometry.geometryBuckets[j];
  //         geometryView.geometryBucketIndex = j;
  //         if (withEachGeometry(<GeometryView>geometryView)) {
  //             return true;
  //         }
  //     }
  // }
  return false;
}
