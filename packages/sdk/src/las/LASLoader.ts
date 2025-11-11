import {BasicAggregation, BasicEntity} from "../basictypes";
import {createMat4, createVec3, transformPoint3} from "../matrix";
import type {ModelLoadParams, ModelParseParams} from "../io";
import {ModelLoader} from "../io";
import {createUUID} from "../utils";
import {LASLoader as glLASLoader} from '@loaders.gl/las';
import type {LASLoaderOptions} from "./LASLoaderOptions";
import {parse} from '@loaders.gl/core';
import {PointsPrimitive} from "../constants";

const MAX_VERTICES = 500000; // TODO: Rough estimate

/**
 * Loads a LAS/LAZ file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link las | @xeokit/sdk/las}.
 */
export class LASLoader extends ModelLoader {
  constructor() {
    super({
      format: "LAS",
      fileDataType: "arraybuffer",
      parsers: {
        "*": parseLAS
      },
      getVersion: (fileData: any): string => {
        return "*";
      }
    });
  }

  /**
   * Loads LAS/LAZ file data into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
   *
   * @param params - The parameters used for loading the file data.
   * @param options - Options for loading the LAS/LAZ file.
   * @returns {Promise} Resolves when the file data has been successfully loaded into the SceneModel and/or DataModel.
   *
   * @throws {@link core!SDKError | SDKError}
   * - If the SceneModel has already been destroyed.
   * - If the DataModel has already been destroyed.
   */
  load(params: ModelLoadParams, options: LASLoaderOptions = {}): Promise<any> {
    return super.load(params, options);
  }
}

function parseLAS(params: ModelParseParams, options: LASLoaderOptions = {}): Promise<void> {

  return new Promise(function (resolve, reject) {
    const {sceneModel, dataModel, fileData} = params;
    if (!sceneModel && !dataModel) {
      return resolve();
    }
    const skip = options.skip || 1;
    const log = (msg) => {
      if (params.log) {
        params.log(msg);
      }
    }
    parse(params.fileData, glLASLoader, {
      las: {
        colorDepth: options.colorDepth || "auto",
        fp64: options.fp64 !== undefined ? options.fp64 : false
      }
    }).then((parsedData) => {
      const entityId = createUUID();
      if (sceneModel) {
        const meshIds = [];
        const attributes = parsedData.attributes;
        const loaderData = parsedData.loaderData;
        const pointsFormatId = loaderData.pointsFormatId !== undefined ? loaderData.pointsFormatId : -1;
        if (!attributes.POSITION) {
          log("No positions found in file (expected for all LAS point formats)");
          return;
        }
        let readAttributes: any = {};
        switch (pointsFormatId) {
          case 0:
            if (!attributes.intensity) {
              log("No intensities found in file (expected for LAS point format 0)");
              return;
            }
            readAttributes = readIntensities(attributes.POSITION, attributes.intensity);
            break;
          case 1:
            if (!attributes.intensity) {
              log("No intensities found in file (expected for LAS point format 1)");
              return;
            }
            readAttributes = readIntensities(attributes.POSITION, attributes.intensity);
            break;
          case 2:
            if (!attributes.intensity) {
              log("No intensities found in file (expected for LAS point format 2)");
              return;
            }
            readAttributes = readColorsAndIntensities(attributes.POSITION, attributes.COLOR_0, attributes.intensity);
            break;
          case 3:
            if (!attributes.intensity) {
              log("No intensities found in file (expected for LAS point format 3)");
              return;
            }
            readAttributes = readColorsAndIntensities(attributes.POSITION, attributes.COLOR_0, attributes.intensity);
            break;
        }
        const pointsChunks = chunkArray(readPositions(readAttributes.positions), MAX_VERTICES * 3);
        const colorsChunks = chunkArray(readAttributes.colors, MAX_VERTICES * 4);
        for (let j = 0, lenj = pointsChunks.length; j < lenj; j++) {
          const geometryId = `geometry-${j}`;
          const geometryResult = sceneModel.createGeometry({
            id: geometryId,
            primitive: PointsPrimitive,
            positions: pointsChunks[j],
            colorsCompressed: colorsChunks[j]
          });
          if (geometryResult.ok===false) {
            log(`[ERROR] Cannot load point cloud: ${geometryResult.error}`);
          } else {
            const meshId = `mesh-${j}`;
            meshIds.push(meshId);
            const meshResult = sceneModel.createMesh({
              id: meshId,
              geometryId
            });
            if (meshResult.ok===false) {
              log(`[ERROR] Cannot load point cloud: ${meshResult.error}`);
            }
          }
        }
        sceneModel.createObject({
          id: entityId,
          meshIds
        });
      }
      if (dataModel) {
        const rootMetaObjectId = createUUID();
        dataModel.createObject({
          id: rootMetaObjectId,
          type: BasicEntity,
          name: "Model",
        });
        dataModel.createObject({
          id: entityId,
          type: BasicEntity,
          name: "PointCloud (LAZ)",
        });
        dataModel.createRelationship({
          type: BasicAggregation,
          relatingObjectId: rootMetaObjectId,
          relatedObjectId: entityId
        });
      }
      resolve();
    }, (errMsg) => {
      return reject(`Error parsing LAS/LAZ data: ${errMsg}`);
    });

    function readPositions(positionsValue) {
      if (positionsValue) {
        if (options.center) {
          const centerPos = createVec3();
          const numPoints = positionsValue.length;
          for (let i = 0, len = positionsValue.length; i < len; i += 3) {
            centerPos[0] += positionsValue[i + 0];
            centerPos[1] += positionsValue[i + 1];
            centerPos[2] += positionsValue[i + 2];
          }
          centerPos[0] /= numPoints;
          centerPos[1] /= numPoints;
          centerPos[2] /= numPoints;
          for (let i = 0, len = positionsValue.length; i < len; i += 3) {
            positionsValue[i + 0] -= centerPos[0];
            positionsValue[i + 1] -= centerPos[1];
            positionsValue[i + 2] -= centerPos[2];
          }
        }
        if (options.transform) {
          const mat = createMat4(options.transform);
          const pos = createVec3();
          for (let i = 0, len = positionsValue.length; i < len; i += 3) {
            pos[0] = positionsValue[i + 0];
            pos[1] = positionsValue[i + 1];
            pos[2] = positionsValue[i + 2];
            transformPoint3(mat, pos, pos);
            positionsValue[i + 0] = pos[0];
            positionsValue[i + 1] = pos[1];
            positionsValue[i + 2] = pos[2];
          }
        }
      }
      return positionsValue;
    }

    function readColorsAndIntensities(attributesPosition, attributesColor, attributesIntensity) {
      const positionsValue = attributesPosition.value;
      const colors = attributesColor.value;
      const colorSize = attributesColor.size;
      const intensities = attributesIntensity.value;
      const colorsCompressedSize = intensities.length * 4;
      const positions = [];
      const colorsCompressed = new Uint8Array(colorsCompressedSize / skip);
      let count = skip;
      for (let i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, len = intensities.length; i < len; i++, k += colorSize, j += 4, l += 3) {
        if (count <= 0) {
          colorsCompressed[m++] = colors[k + 0];
          colorsCompressed[m++] = colors[k + 1];
          colorsCompressed[m++] = colors[k + 2];
          colorsCompressed[m++] = Math.round((intensities[i] / 65536) * 255);
          positions[n++] = positionsValue[l + 0];
          positions[n++] = positionsValue[l + 1];
          positions[n++] = positionsValue[l + 2];
          count = skip;
        } else {
          count--;
        }
      }
      return {
        positions,
        colors: colorsCompressed
      };
    }

    function readIntensities(attributesPosition, attributesIntensity) {
      const positionsValue = attributesPosition.value;
      const intensities = attributesIntensity.intensity;
      const colorsCompressedSize = intensities.length * 4;
      const positions = [];
      const colorsCompressed = new Uint8Array(colorsCompressedSize / skip);
      let count = skip;
      for (let i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, len = intensities.length; i < len; i++, k += 3, j += 4, l += 3) {
        if (count <= 0) {
          colorsCompressed[m++] = 0;
          colorsCompressed[m++] = 0;
          colorsCompressed[m++] = 0;
          colorsCompressed[m++] = Math.round((intensities[i] / 65536) * 255);
          positions[n++] = positionsValue[l + 0];
          positions[n++] = positionsValue[l + 1];
          positions[n++] = positionsValue[l + 2];
          count = skip;
        } else {
          count--;
        }
      }
      return {
        positions,
        colors: colorsCompressed
      };
    }

    function chunkArray(array, chunkSize) {
      if (chunkSize >= array.length) {
        return [array]; // One chunk
      }
      const result = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize));
      }
      return result;
    }
  });
}
