import * as utils from "@xeokit/utils";
import type {GeometryArrays} from "./GeometryArrays";
import {TrianglesPrimitive} from "@xeokit/constants";

/**
 * Creates a cylinder-shaped geometry.
 *
 * ## Usage
 *
 * Creating a {@link @xeokit/scene!SceneMesh} with a cylinder-shaped {@link @xeokit/scene!SceneGeometry}:
 *
 * ````javascript
 *
 * ````
 *
 * @function buildCylinderGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID for the {@link @xeokit/scene!SceneGeometry}, unique among all components in the parent {@link @xeokit/scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.center]  3D point indicating the center position.
 * @param [cfg.radiusTop=1]  Radius of top.
 * @param [cfg.radiusBottom=1]  Radius of bottom.
 * @param [cfg.height=1] Height.
 * @param [cfg.radialSegments=60]  Number of horizontal segments.
 * @param [cfg.heightSegments=1]  Number of vertical segments.
 * @param [cfg.openEnded=false]  Whether or not the cylinder has solid caps on the ends.
 * @returns {Object} Configuration for a {@link @xeokit/scene!SceneGeometry} subtype.
 */
export function buildCylinderGeometry(cfg: {
    radiusBottom: number;
    center: (number[] | Float32Array | Float64Array);
    radialSegments: number;
    heightSegments: number;
    openEnded: boolean;
    radiusTop: number;
    height: number
} = {
    radiusTop: 1,
    radiusBottom: 1,
    height: 1,
    radialSegments: 60,
    heightSegments: 1,
    openEnded: false,
    center: [0, 0, 0]
}): GeometryArrays  {

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

    let center = cfg.center;
    const centerX = center ? center[0] : 0;
    const centerY = center ? center[1] : 0;
    const centerZ = center ? center[2] : 0;

    const heightHalf = height / 2;
    const heightLength = height / heightSegments;
    const radialAngle = (2.0 * Math.PI / radialSegments);
    const radialLength = 1.0 / radialSegments;
    //var nextRadius = this._radiusBottom;
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
