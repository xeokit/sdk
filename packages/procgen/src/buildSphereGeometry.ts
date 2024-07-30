import * as utils from "@xeokit/utils";
import type {GeometryArrays} from "./GeometryArrays";
import {TrianglesPrimitive} from "@xeokit/constants";

/**
 * Creates a sphere-shaped {@link @xeokit/scene!SceneGeometry}.
 *
 * ## Usage
 *
 * ````javascript

 * ````
 *
 * @function buildSphereGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID for the {@link @xeokit/scene!SceneGeometry}, unique among all components in the parent {@link @xeokit/scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.center]  3D point indicating the center position.
 * @param [cfg.radius=1]  Radius.
 * @param [cfg.heightSegments=24] Number of latitudinal bands.
 * @param  {Number} [cfg.widthSegments=18] Number of longitudinal bands.
 * @returns {Object} Configuration for a {@link @xeokit/scene!SceneGeometry} subtype.
 */
export function buildSphereGeometry(cfg: {
    center: number[];
    heightSegments: number;
    radius: number;
    widthSegments: number
} = {
    heightSegments: 18,
    widthSegments: 18,
    radius: 1,
    center: [0, 0, 0]
}) : GeometryArrays {

    const centerX = cfg.center ? cfg.center[0] : 0;
    const centerY = cfg.center ? cfg.center[1] : 0;
    const centerZ = cfg.center ? cfg.center[2] : 0;

    let radius = cfg.radius || 1;
    if (radius < 0) {
        console.error("negative radius not allowed - will invert");
        radius *= -1;
    }

    let heightSegments = cfg.heightSegments || 18;
    if (heightSegments < 0) {
        console.error("negative heightSegments not allowed - will invert");
        heightSegments *= -1;
    }
    heightSegments = Math.floor(heightSegments);
    if (heightSegments < 18) {
        heightSegments = 18;
    }

    let widthSegments = cfg.widthSegments || 18;
    if (widthSegments < 0) {
        console.error("negative widthSegments not allowed - will invert");
        widthSegments *= -1;
    }
    widthSegments = Math.floor(widthSegments);
    if (widthSegments < 18) {
        widthSegments = 18;
    }

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    let i;
    let j;

    let theta;
    let sinTheta;
    let cosTheta;

    let phi;
    let sinPhi;
    let cosPhi;

    let x;
    let y;
    let z;

    let u;
    let v;

    let first;
    let second;

    for (i = 0; i <= heightSegments; i++) {

        theta = i * Math.PI / heightSegments;
        sinTheta = Math.sin(theta);
        cosTheta = Math.cos(theta);

        for (j = 0; j <= widthSegments; j++) {

            phi = j * 2 * Math.PI / widthSegments;
            sinPhi = Math.sin(phi);
            cosPhi = Math.cos(phi);

            x = cosPhi * sinTheta;
            y = cosTheta;
            z = sinPhi * sinTheta;
            u = 1.0 - j / widthSegments;
            v = i / heightSegments;

            normals.push(x);
            normals.push(y);
            normals.push(z);

            uvs.push(u);
            uvs.push(v);

            positions.push(centerX + radius * x);
            positions.push(centerY + radius * y);
            positions.push(centerZ + radius * z);
        }
    }

    for (i = 0; i < heightSegments; i++) {
        for (j = 0; j < widthSegments; j++) {

            first = (i * (widthSegments + 1)) + j;
            second = first + widthSegments + 1;

            indices.push(first + 1);
            indices.push(second + 1);
            indices.push(second);
            indices.push(first + 1);
            indices.push(second);
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
