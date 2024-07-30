import * as utils from "@xeokit/utils";
import type {GeometryArrays} from "./GeometryArrays";

/**
 * Creates a grid-shaped {@link @xeokit/scene!SceneGeometry}.
 *
 * ## Usage
 *
 * Creating a {@link @xeokit/scene!SceneMesh} with a grid-shaped {@link @xeokit/scene!SceneGeometry}:
 *
 * ````javascript

 * ````
 *
 * @function buildGridGeometry
 * @param cfg Configs
 * @param [cfg.id] Optional ID for the {@link @xeokit/scene!SceneGeometry}, unique among all components in the parent {@link @xeokit/scene!Scene | Scene}, generated automatically when omitted.
 * @param [cfg.size=1] Dimension on the X and Z-axis.
 * @param [cfg.divisions=1] Number of divisions on X and Z axis..
 * @returns {Object} Configuration for a {@link @xeokit/scene!SceneGeometry} subtype.
 */
export function buildGridGeometry(cfg = {
    size: 1,
    divisions: 1
}): GeometryArrays  {

    let size = cfg.size || 1;
    if (size < 0) {
        console.error("negative size not allowed - will invert");
        size *= -1;
    }

    let divisions = cfg.divisions || 1;
    if (divisions < 0) {
        console.error("negative divisions not allowed - will invert");
        divisions *= -1;
    }
    if (divisions < 1) {
        divisions = 1;
    }

    size = size || 10;
    divisions = divisions || 10;

    const step = size / divisions;
    const halfSize = size / 2;

    const positions = [];
    const indices = [];
    let l = 0;

    for (let i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {

        positions.push(-halfSize);
        positions.push(0);
        positions.push(k);

        positions.push(halfSize);
        positions.push(0);
        positions.push(k);

        positions.push(k);
        positions.push(0);
        positions.push(-halfSize);

        positions.push(k);
        positions.push(0);
        positions.push(halfSize);

        indices.push(l++);
        indices.push(l++);
        indices.push(l++);
        indices.push(l++);
    }

    return utils.apply(cfg, {
        primitive: "lines",
        positions: positions,
        indices: indices
    });
}

