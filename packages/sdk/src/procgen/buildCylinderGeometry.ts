import * as utils from "../utils";
import type {FloatArrayParam} from "../math";
import type {GeometryArrays} from "./GeometryArrays";
import {TrianglesPrimitive} from "../constants";
import {SDKErrorType, type SDKResult} from "../core";

/**
 * Creates a cylinder-shaped geometry.
 *
 * This function generates the geometry arrays required for a cylinder mesh. The cylinder can be configured in terms of its top and bottom radii, height, radial and height segments, and whether it has caps on its ends.
 * It returns the geometry arrays, including vertex positions, normals, texture coordinates (UVs), and indices for the cylinder's faces.
 *
 * ## Usage
 *
 * ````javascript
 * const cylinderGeometryResult = buildCylinderGeometry({
 *     center: [0, 0, 0],        // Center of the cylinder
 *     radiusTop: 1,             // Radius of the top of the cylinder
 *     radiusBottom: 1,          // Radius of the bottom of the cylinder
 *     height: 2,                // Height of the cylinder
 *     radialSegments: 32,       // Number of segments around the cylinder
 *     heightSegments: 1,        // Number of segments vertically
 *     openEnded: false          // Whether the cylinder has caps at the ends
 * });
 *
 * if (cylinderGeometryResult.ok) {
 *    const cylinderGeometry = cylinderGeometryResult.value;
 *    // Use cylinderGeometry here
 * } else {
 *    console.error("Error creating cylinder geometry:", cylinderGeometryResult.error);
 * }
 * ````
 *
 * @param cfg Configuration for the cylinder geometry.
 * @param [cfg.center=[0,0,0]] The center position of the cylinder in 3D space, default is `[0, 0, 0]`.
 * @param [cfg.radiusTop=1] The radius of the top of the cylinder. Default is `1`.
 * @param [cfg.radiusBottom=1] The radius of the bottom of the cylinder. Default is `1`.
 * @param [cfg.height=1] The height of the cylinder. Default is `1`.
 * @param [cfg.radialSegments=60] The number of radial (horizontal) segments. Default is `60`.
 * @param [cfg.heightSegments=1] The number of vertical segments. Default is `1`.
 * @param [cfg.openEnded=false] Whether or not the cylinder has solid caps at the top and bottom. Default is `false`.
 * @returns {SDKResult<GeometryArrays>} The geometry arrays for the cylinder, including positions, normals, UVs, and indices, or an error message.
 */
export function buildCylinderGeometry(cfg: {
    center?: FloatArrayParam;
    radiusTop?: number;
    radiusBottom?: number;
    height?: number;
    radialSegments?: number;
    heightSegments?: number;
    openEnded?: boolean;
} = {
    center: [0, 0, 0],
    radiusTop: 1,
    radiusBottom: 1,
    height: 1,
    radialSegments: 60,
    heightSegments: 1,
    openEnded: false,
}): SDKResult<GeometryArrays> {
    const center = cfg.center || [0, 0, 0];
    const radiusTop = cfg.radiusTop ?? 1;
    const radiusBottom = cfg.radiusBottom ?? 1;
    const height = cfg.height ?? 1;
    const radialSegments = cfg.radialSegments ?? 60;
    const heightSegments = cfg.heightSegments ?? 1;
    const openEnded = cfg.openEnded ?? false;

  if (center.length !== 3) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildCylinderGeometry] Center must be a 3D point [x, y, z]."
    };
  }

  if (radiusTop < 0 || radiusBottom < 0) {
        return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: "[buildCylinderGeometry] Negative radius values are not allowed."
        };
    }
    if (height < 0) {
        return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: "[buildCylinderGeometry] Negative height is not allowed."
        };
    }
    if (radialSegments < 3) {
        return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: "[buildCylinderGeometry] radialSegments must be at least 3."
        };
    }
    if (heightSegments < 1) {
        return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: "[buildCylinderGeometry] heightSegments must be at least 1."
        };
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const halfHeight = height / 2;

    for (let y = 0; y <= heightSegments; y++) {
        const indexRow: number[] = [];
        const v = y / heightSegments;
        const radius = v * (radiusBottom - radiusTop) + radiusTop;

        for (let x = 0; x <= radialSegments; x++) {
            const u = x / radialSegments;
            const theta = u * Math.PI * 2;

            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            const vertexX = radius * sinTheta;
            const vertexY = -v * height + halfHeight;
            const vertexZ = radius * cosTheta;

            positions.push(vertexX + center[0], vertexY + center[1], vertexZ + center[2]);
            normals.push(sinTheta, 0, cosTheta);
            uvs.push(u, 1 - v);

            indexRow.push(positions.length / 3 - 1);
        }

        if (y > 0) {
            for (let x = 0; x < radialSegments; x++) {
                const a = indexRow[x];
                const b = indexRow[x + 1];
                const c = indexRow[x + radialSegments + 1];
                const d = indexRow[x + radialSegments];

                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }
    }

    if (!openEnded) {
        const cap = (isTop: boolean) => {
            const sign = isTop ? 1 : -1;
            const radius = isTop ? radiusTop : radiusBottom;
            const centerIndex = positions.length / 3;

            positions.push(center[0], center[1] + sign * halfHeight, center[2]);
            normals.push(0, sign, 0);
            uvs.push(0.5, 0.5);

            for (let x = 0; x <= radialSegments; x++) {
                const theta = (x / radialSegments) * Math.PI * 2;
                const cosTheta = Math.cos(theta);
                const sinTheta = Math.sin(theta);

                positions.push(
                    radius * sinTheta + center[0],
                    center[1] + sign * halfHeight,
                    radius * cosTheta + center[2]
                );
                normals.push(0, sign, 0);
                uvs.push((cosTheta + 1) / 2, (sinTheta + 1) / 2);

                if (x > 0) {
                    const a = centerIndex;
                    const b = centerIndex + x;
                    const c = centerIndex + x + 1;

                    if (isTop) {
                        indices.push(a, b, c);
                    } else {
                        indices.push(a, c, b);
                    }
                }
            }
        };

        cap(true);
        cap(false);
    }

    const geometryArrays: GeometryArrays = {
        primitive: TrianglesPrimitive,
        positions,
        normals,
        uv: uvs,
        indices,
    };

    return {ok: true, value: geometryArrays};
}
