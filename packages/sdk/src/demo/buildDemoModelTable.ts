
import {SDKErrorType, type SDKResult} from "../base/core";
import type {Vec3} from "../base/math/vector";
import {SceneModel} from "../model/scene";
import {DataModel} from "../model/data";
import {TrianglesPrimitive} from "../base/constants";
import {createUUID} from "../base/utils";

/**
 * Builds a simple table model with a top and four legs, using box geometries.
 *
 * @param cfg Configuration for building the demo model table.
 * - `position` (optional): A 3D point [x, y, z] specifying the position of the table in the scene. If not provided, the table will be positioned at the origin [0, 0, 0].
 * - `sceneModel`: The SceneModel instance where the table will be added.
 * - `dataModel`: The DataModel instance for any data-related operations (not used in this specific implementation but included for potential future use).
 */
export function buildDemoModelTable(cfg: {
  position?: Vec3,
  sceneModel:SceneModel,
  dataModel:DataModel
}): SDKResult<any> {

  const {sceneModel, dataModel, position} = cfg;

  if (position && position.length !== 3) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildDemoModelTable] position must be a 3D point [x, y, z]"
    };
  }

  const uuid = createUUID();

  const sceneTransformResult = sceneModel.createTransform({
  id: `${uuid}-transform}`,
    position: position || [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  });

if (sceneTransformResult.ok===false) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: `[buildDemoModelTable] Failed to create transform for model: ${sceneTransformResult.error}`
    };
}

const sceneTransform = sceneTransformResult.value;

  const fromParamsResult = sceneModel.fromParams({
    geometries: [
      {
        id: `${uuid}-geometry`,
        primitive:TrianglesPrimitive,
        positions: [
          1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
          -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
          -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
        ],
        uvs: [
          1, 0, 0, 0, 0, 1, 1, 1,// v0-v1-v2-v3 front
          0, 0, 0, 1, 1, 1, 1, 0,// v0-v3-v4-v1 right
          1, 1, 1, 0, 0, 0, 0, 1,// v0-v1-v6-v1 top
          1, 0, 0, 0, 0, 1, 1, 1,// v1-v6-v7-v2 left
          0, 1, 1, 1, 1, 0, 0, 0,// v7-v4-v3-v2 bottom
          0, 1, 1, 1, 1, 0, 0, 0 // v4-v7-v6-v1 back
        ],
        indices: [
          0, 1, 2, 0, 2, 3,            // front
          4, 5, 6, 4, 6, 7,            // right
          8, 9, 10, 8, 10, 11,         // top
          12, 13, 14, 12, 14, 15,      // left
          16, 17, 18, 16, 18, 19,      // bottom
          20, 21, 22, 20, 22, 23
        ]
      }
    ],
    meshes: [
      {
        id: `${uuid}-redLeg-mesh`,
        geometryId: `${uuid}-geometry`,
        position: [-4, -4, -6],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [1, 0.3, 0.3],
        parentTransformId: sceneTransform.id
      },
      {
        id: `${uuid}-greenLeg-mesh`,
        geometryId: `${uuid}-geometry`,
        position: [4, -4,-6],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [0.3, 1.0, 0.3],
        parentTransformId: sceneTransform.id
      },
      {
        id: `${uuid}-blueLeg-mesh`,
        geometryId: `${uuid}-geometry`,
        position: [4, 4, -6],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [0.3, 0.3, 1.0],
        parentTransformId: sceneTransform.id
      },
      {
        id: `${uuid}-yellowLeg-mesh`,
        geometryId: `${uuid}-geometry`,
        position: [-4, 4, -6],
        scale: [1, 1, 3],
        rotation: [0, 0, 0],
        color: [1.0, 1.0, 0.0],
        parentTransformId: sceneTransform.id
      },
      {
        id: `${uuid}-tableTop-mesh`,
        geometryId: `${uuid}-geometry`,
        position: [0, 0,-3],
        scale: [6,  6, 0.5],
        rotation: [0, 0, 0],
        color: [1.0, 0.3, 1.0],
        parentTransformId: sceneTransform.id
      }
    ],
    objects: [
      {
        id: `${uuid}-redLeg`,
        meshIds: [`${uuid}-redLeg-mesh`]
      },
      {
        id: `${uuid}-greenLeg`,
        meshIds: [`${uuid}-greenLeg-mesh`]
      },
      {
        id: `${uuid}-blueLeg`,
        meshIds: [`${uuid}-blueLeg-mesh`]
      },
      {
        id: `${uuid}-yellowLeg`,
        meshIds: [`${uuid}-yellowLeg-mesh`]
      },
      {
        id: `${uuid}-purpleTableTop`,
        meshIds: [`${uuid}-tableTop-mesh`]
      }]
  });

  if (fromParamsResult.ok===false) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: `[buildDemoModelTable] Failed to build model from params: ${fromParamsResult.error}`
    };
  }

  return {
    ok: true,
    value: undefined
  };
}
