import type { FloatArrayParam, IntArrayParam } from "@xeokit/math";
import { PrimsKdTree3 } from "./PrimsKdTree3";
/**
 * Creates a KdTree3 that indexes the 3D primitives in the given arrays.
 *
 * This function does not care which coordinate space the primitives are in (ie. Local, World, View etc).
 *
 * This function also works for coordinates of any precision (ie. Float32Array, Float64Array, Int16Array, Int32Array etc).
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export declare function createPrimsKdTree3(primitiveType: number, positions: FloatArrayParam, indices?: IntArrayParam): PrimsKdTree3;
