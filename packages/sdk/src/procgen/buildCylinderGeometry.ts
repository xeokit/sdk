import * as utils from "../utils";
import type { GeometryArrays } from "./GeometryArrays";
import { TrianglesPrimitive } from "../constants";
import { FloatArrayParam } from "../math";

/**
 * Creates a cylinder-shaped geometry.
 *
 * This function generates the geometry arrays required for a cylinder mesh. The cylinder can be configured in terms of its top and bottom radii, height, radial and height segments, and whether it has caps on its ends.
 * It returns the geometry arrays, including vertex positions, normals, texture coordinates (UVs), and indices for the cylinder's faces.
 *
 * ## Usage
 *
 * ````javascript
 * const cylinderGeometry = buildCylinderGeometry({
 *     center: [0, 0, 0],        // Center of the cylinder
 *     radiusTop: 1,             // Radius of the top of the cylinder
 *     radiusBottom: 1,          // Radius of the bottom of the cylinder
 *     height: 2,                // Height of the cylinder
 *     radialSegments: 32,       // Number of segments around the cylinder
 *     heightSegments: 1,        // Number of segments vertically
 *     openEnded: false          // Whether the cylinder has caps at the ends
 * });
 * ````
 *
 * @param cfg Configuration for the cylinder geometry.
 * @param [cfg.id] Optional ID for the {@link scene!SceneGeometry | SceneGeometry}, unique among all components in the parent {@link scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.center=[0,0,0]] The center position of the cylinder in 3D space, default is `[0, 0, 0]`.
 * @param [cfg.radiusTop=1] The radius of the top of the cylinder. Default is `1`.
 * @param [cfg.radiusBottom=1] The radius of the bottom of the cylinder. Default is `1`.
 * @param [cfg.height=1] The height of the cylinder. Default is `1`.
 * @param [cfg.radialSegments=60] The number of radial (horizontal) segments. Default is `60`.
 * @param [cfg.heightSegments=1] The number of vertical segments. Default is `1`.
 * @param [cfg.openEnded=false] Whether or not the cylinder has solid caps at the top and bottom. Default is `false`.
 * @returns {GeometryArrays} The geometry arrays for the cylinder, including positions, normals, UVs, and indices for the faces.
 *
 * @throws {SDKError} If any of the size parameters (`radiusTop`, `radiusBottom`, `height`, `radialSegments`, `heightSegments`) are negative, the function automatically inverts the values and logs a warning.
 */
export function buildCylinderGeometry(cfg: {
  radiusBottom: number;
  center: FloatArrayParam;
  radialSegments: number;
  heightSegments: number;
  openEnded: boolean;
  radiusTop: number;
  height: number;
} = {
  radiusTop: 1,
  radiusBottom: 1,
  height: 1,
  radialSegments: 60,
  heightSegments: 1,
  openEnded: false,
  center: [0, 0, 0]
}): GeometryArrays {

  let radiusTop = cfg.radiusTop || 1;
  if (radiusTop < 0) {
    console.error("negative radiusTop not allowed - will invert");
    radiusTop *= -1;
  }

  let radiusBottom = cfg.radiusBottom || 1;
  if (radiusBottom < 0) {
    console.error("negative radiusBottom not allowed - will invert");
    radiusBottom *= -1;
  }

  let height = cfg.height || 1;
  if (height < 0) {
    console.error("negative height not allowed - will invert");
    height *= -1;
  }

  let radialSegments = cfg.radialSegments || 32;
  if (radialSegments < 0) {
    console.error("negative radialSegments not allowed - will invert");
    radialSegments *= -1;
  }
  if (radialSegments < 3) {
    radialSegments = 3;
  }

  let heightSegments = cfg.heightSegments || 1;
  if (heightSegments < 0) {
    console.error("negative heightSegments not allowed - will invert");
    heightSegments *= -1;
  }
  if (heightSegments < 1) {
    heightSegments = 1;
  }

  const openEnded = cfg.openEnded;

  const center = cfg.center;
  const centerX = center ? center[0] : 0;
  const centerY = center ? center[1] : 0;
  const centerZ = center ? center[2] : 0;

  const heightHalf = height / 2;
  const heightLength = height / heightSegments;
  const radialAngle = (2.0 * Math.PI / radialSegments);
  const radialLength = 1.0 / radialSegments;
  const radiusChange = (radiusTop - radiusBottom) / heightSegments;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  let h;
  let i;

  let x;
  let z;

  let currentRadius;
  let currentHeight;

  let first;
  let second;

  let startIndex;
  let tu;
  let tv;

  // create vertices
  const normalY = (90.0 - (Math.atan(height / (radiusBottom - radiusTop))) * 180 / Math.PI) / 90.0;

  for (h = 0; h <= heightSegments; h++) {
    currentRadius = radiusTop - h * radiusChange;
    currentHeight = heightHalf - h * heightLength;

    for (i = 0; i <= radialSegments; i++) {
      x = Math.sin(i * radialAngle);
      z = Math.cos(i * radialAngle);

      normals.push(currentRadius * x);
      normals.push(normalY); //todo
      normals.push(currentRadius * z);

      uvs.push((i * radialLength));
      uvs.push(h * 1 / heightSegments);

      positions.push((currentRadius * x) + centerX);
      positions.push((currentHeight) + centerY);
      positions.push((currentRadius * z) + centerZ);
    }
  }

  // create faces
  for (h = 0; h < heightSegments; h++) {
    for (i = 0; i <= radialSegments; i++) {

      first = h * (radialSegments + 1) + i;
      second = first + radialSegments;

      indices.push(first);
      indices.push(second);
      indices.push(second + 1);

      indices.push(first);
      indices.push(second + 1);
      indices.push(first + 1);
    }
  }

  // create top cap
  if (!openEnded && radiusTop > 0) {
    startIndex = (positions.length / 3);

    // top center
    normals.push(0.0);
    normals.push(1.0);
    normals.push(0.0);

    uvs.push(0.5);
    uvs.push(0.5);

    positions.push(0 + centerX);
    positions.push(heightHalf + centerY);
    positions.push(0 + centerZ);

    // top triangle fan
    for (i = 0; i <= radialSegments; i++) {
      x = Math.sin(i * radialAngle);
      z = Math.cos(i * radialAngle);
      tu = (0.5 * Math.sin(i * radialAngle)) + 0.5;
      tv = (0.5 * Math.cos(i * radialAngle)) + 0.5;

      normals.push(radiusTop * x);
      normals.push(1.0);
      normals.push(radiusTop * z);

      uvs.push(tu);
      uvs.push(tv);

      positions.push((radiusTop * x) + centerX);
      positions.push((heightHalf) + centerY);
      positions.push((radiusTop * z) + centerZ);
    }

    for (i = 0; i < radialSegments; i++) {
      first = startIndex + 1 + i;

      indices.push(first);
      indices.push(first + 1);
      indices.push(startIndex);
    }
  }

  // create bottom cap
  if (!openEnded && radiusBottom > 0) {

    startIndex = (positions.length / 3);

    // top center
    normals.push(0.0);
    normals.push(-1.0);
    normals.push(0.0);

    uvs.push(0.5);
    uvs.push(0.5);

    positions.push(0 + centerX);
    positions.push(0 - heightHalf + centerY);
    positions.push(0 + centerZ);

    // top triangle fan
    for (i = 0; i <= radialSegments; i++) {

      x = Math.sin(i * radialAngle);
      z = Math.cos(i * radialAngle);

      tu = (0.5 * Math.sin(i * radialAngle)) + 0.5;
      tv = (0.5 * Math.cos(i * radialAngle)) + 0.5;

      normals.push(radiusBottom * x);
      normals.push(-1.0);
      normals.push(radiusBottom * z);

      uvs.push(tu);
      uvs.push(tv);

      positions.push((radiusBottom * x) + centerX);
      positions.push((0 - heightHalf) + centerY);
      positions.push((radiusBottom * z) + centerZ);
    }

    for (i = 0; i < radialSegments; i++) {
      first = startIndex + 1 + i;
      indices.push(startIndex);
      indices.push(first + 1);
      indices.push(first);
    }
  }

  return utils.apply(cfg, {
    primitive: TrianglesPrimitive,
    positions: positions,
    normals: normals,
    uv: uvs,
    indices: indices
  });
}
