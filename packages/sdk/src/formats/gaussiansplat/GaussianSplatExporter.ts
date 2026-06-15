import {ModelExporter} from "../ModelExporter";
import type {ModelEncodeParams} from "../ModelEncodeParams";
import {encodeSplat} from "./versions/v1/encodeSplat";
import {decompressPositions3WithAABB3} from "../../base/math/compression";
import {GaussianSplatsPrimitive} from "../../base/constants";

/**
 * Exports the {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}
 * geometries of a {@link model!scene.SceneModel | SceneModel} to the compact `.splat`
 * format (baked RGB, no SH).
 *
 * Like every other format exporter it reads a `SceneModel` through the
 * {@link ModelExporter} base, so splats export as "just another model":
 *
 * ```ts
 * const fileData = await new GaussianSplatExporter().write({ sceneModel });
 * // fileData is an ArrayBuffer of .splat bytes
 * ```
 *
 * Round-trips with {@link GaussianSplatLoader}: a `.splat` loaded and then
 * re-exported reproduces the original scene (positions to within the
 * SceneGeometry's 16-bit position quantisation; scales, colours and rotations
 * exactly).
 *
 * All `GaussianSplatsPrimitive` geometries in the model are concatenated into one
 * `.splat` buffer. Non-splat geometry (triangles, lines, points) is ignored.
 */
export class GaussianSplatExporter extends ModelExporter {
  constructor() {
    super({
      format: "splat",
      fileDataType: "arraybuffer",
      encoders: {"*": encodeSplatModel},
      defaultVersion: "*",
    });
  }
}

async function encodeSplatModel(params: ModelEncodeParams): Promise<ArrayBuffer> {
  const sceneModel = params.sceneModel;
  if (!sceneModel) {
    throw new Error("[GaussianSplatExporter] params.sceneModel is required");
  }

  const geometries = Object.values(sceneModel.geometries).filter(
    geom => geom.primitive === GaussianSplatsPrimitive,
  );

  let count = 0;
  for (const geom of geometries) {
    count += geom.positionsCompressed.length / 3;
  }

  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 4);
  const rotations = new Float32Array(count * 4); // file order [w, x, y, z]

  let offset = 0; // splat index into the concatenated output
  for (const geom of geometries) {
    const n = geom.positionsCompressed.length / 3;

    // Dequantize positions straight into the output slice.
    decompressPositions3WithAABB3(
      geom.positionsCompressed,
      geom.aabb!,
      positions.subarray(offset * 3, (offset + n) * 3),
    );

    const geomScales = geom.scales;
    const geomRotations = geom.rotations; // SceneGeometry stores xyzw
    const geomColors = geom.colorsCompressed;

    for (let i = 0; i < n; i++) {
      const s = offset + i;
      scales[s * 3]     = geomScales ? geomScales[i * 3]     : 0;
      scales[s * 3 + 1] = geomScales ? geomScales[i * 3 + 1] : 0;
      scales[s * 3 + 2] = geomScales ? geomScales[i * 3 + 2] : 0;

      if (geomColors) {
        colors[s * 4]     = geomColors[i * 4];
        colors[s * 4 + 1] = geomColors[i * 4 + 1];
        colors[s * 4 + 2] = geomColors[i * 4 + 2];
        colors[s * 4 + 3] = geomColors[i * 4 + 3];
      } else {
        colors[s * 4] = colors[s * 4 + 1] = colors[s * 4 + 2] = colors[s * 4 + 3] = 255;
      }

      // Reorder stored xyzw back to the file's [w, x, y, z] (inverse of the
      // loader's file → xyzw reorder). Default to identity when absent.
      const x = geomRotations ? geomRotations[i * 4]     : 0;
      const y = geomRotations ? geomRotations[i * 4 + 1] : 0;
      const z = geomRotations ? geomRotations[i * 4 + 2] : 0;
      const w = geomRotations ? geomRotations[i * 4 + 3] : 1;
      rotations[s * 4]     = w;
      rotations[s * 4 + 1] = x;
      rotations[s * 4 + 2] = y;
      rotations[s * 4 + 3] = z;
    }

    offset += n;
  }

  return encodeSplat({count, positions, scales, rotations, colors});
}
