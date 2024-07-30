import * as utils from "@xeokit/utils";
import * as constants from "@xeokit/constants";
import type {GeometryArrays} from "./GeometryArrays";



/**
 * Creates a box-shaped wireframe geometry.
 *
 * ## Usage
 *
 * Creating a {@link @xeokit/scene!SceneMesh} with a box-shaped wireframe {@link @xeokit/scene!SceneGeometry}:
 *
 * ````javascript
 * TODO
 * ````
 *
 * @function buildBoxLinesGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID, unique among all components in the parent {@link @xeokit/scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.center]  3D point indicating the center position.
 * @param [cfg.xSize=1.0]  Half-size on the X-axis.
 * @param [cfg.ySize=1.0]  Half-size on the Y-axis.
 * @param [cfg.zSize=1.0]  Half-size on the Z-axis.
 * @returns {Object} Configuration for a {@link @xeokit/scene!SceneGeometry} subtype.
 */
export function buildBoxLinesGeometry(cfg: {
    center?: (number[] | Float32Array | Float64Array),
    ySize?: number,
    xSize?: number,
    zSize?: number
} = {
    center: [0, 0, 0],
    xSize: 1,
    ySize: 1,
    zSize: 1
}): GeometryArrays {

    let xSize = cfg.xSize || 1;
    if (xSize < 0) {
        console.error("negative xSize not allowed - will invert");
        xSize *= -1;
    }

    let ySize = cfg.ySize || 1;
    if (ySize < 0) {
        console.error("negative ySize not allowed - will invert");
        ySize *= -1;
    }

    let zSize = cfg.zSize || 1;
    if (zSize < 0) {
        console.error("negative zSize not allowed - will invert");
        zSize *= -1;
    }

    const center = cfg.center;
    const centerX = center ? center[0] : 0;
    const centerY = center ? center[1] : 0;
    const centerZ = center ? center[2] : 0;

    const xmin = -xSize + centerX;
    const ymin = -ySize + centerY;
    const zmin = -zSize + centerZ;
    const xmax = xSize + centerX;
    const ymax = ySize + centerY;
    const zmax = zSize + centerZ;

    return utils.apply(cfg, {
        primitive: constants.LinesPrimitive,
        positions: [
            xmin, ymin, zmin,
            xmin, ymin, zmax,
            xmin, ymax, zmin,
            xmin, ymax, zmax,
            xmax, ymin, zmin,
            xmax, ymin, zmax,
            xmax, ymax, zmin,
            xmax, ymax, zmax
        ],
        indices: [
            0, 1,
            1, 3,
            3, 2,
            2, 0,
            4, 5,
            5, 7,
            7, 6,
            6, 4,
            0, 4,
            1, 5,
            2, 6,
            3, 7
        ]
    });
}


