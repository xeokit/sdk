import type { GeometryParams } from "./GeometryParams";
import type { GeometryCompressedParams } from "./GeometryCompressedParams";
/**
 * Compresses a {@link @xeokit/scene!GeometryParams | GeometryParams} into a {@link @xeokit/scene!GeometryCompressedParams | GeometryCompressedParams}.
 *
 * See {@link @xeokit/scene} for usage examples.
 *
 * @param geometryParams Uncompressed geometry params.
 * @returns Compressed geometry params.
 */
export declare function compressGeometryParams(geometryParams: GeometryParams): GeometryCompressedParams;
