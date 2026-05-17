
import {createMat4Float64, transformPoint3} from "../../base/math/matrix";
import { createVec3Float64} from "../../base/math/vector";
import {ModelLoader} from "../ModelLoader";
import {createUUID, yieldToHost} from "../../base/utils";
import {LASLoader as glLASLoader} from '@loaders.gl/las';
import type {LASLoaderOptions} from "./LASLoaderOptions";
import {parse} from '@loaders.gl/core';
import {PointsPrimitive} from "../../base/constants";
import type {ModelLoadParams} from "../ModelLoadParams";
import type {ModelParseParams} from "../ModelParseParams";
import type {LoaderProgress} from "../LoaderProgress";

const MAX_VERTICES = 20000; // TODO: Rough estimate

/**
 * Loads a LAS/LAZ file into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link las | @xeokit/sdk/formats/las}.
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
   * Loads LAS/LAZ file data into a {@link model!scene.SceneModel | SceneModel} and/or a {@link model!data.DataModel | DataModel}.
   *
   * @param params - The parameters used for loading the file data.
   * @param options - Options for loading the LAS/LAZ file.
   * @returns {Promise} Resolves when the file data has been successfully loaded into the SceneModel and/or DataModel.
   *
   * @throws
   * - If the SceneModel has already been destroyed.
   * - If the DataModel has already been destroyed.
   */
  load(params: ModelLoadParams, options: LASLoaderOptions = {
    layerId: "default"
  }): Promise<any> {
    return super.load(params, options);
  }
}

async function parseLAS(params: ModelParseParams, options: LASLoaderOptions = {}): Promise<void> {

  const {sceneModel, dataModel, fileData} = params;
  if (!sceneModel && !dataModel) {
    return;
  }
  const skip = options.skip || 1;
  const log = (msg: string) => {
    if (params.log) {
      params.log(msg);
    }
  };

  const onProgress: ((p: LoaderProgress) => void) | undefined = (options as any).onProgress;
  const signal: AbortSignal | undefined = (options as any).signal;
  const progress: LoaderProgress = {phase: "Parsing LAS/LAZ", current: 0, total: 0};
  const emit = (phase: string, current: number, total: number): void => {
    if (!onProgress) return;
    progress.phase = phase;
    progress.current = current;
    progress.total = total;
    onProgress(progress);
  };
  const step = async (phase: string, current: number, total: number): Promise<void> => {
    emit(phase, current, total);
    await yieldToHost(signal);
  };

  emit("Parsing LAS/LAZ", 0, 0);
  await yieldToHost(signal);
  let parsedData: any;
  try {
    parsedData = await parse(params.fileData, glLASLoader, {
      las: {
        colorDepth: options.colorDepth || "auto",
        fp64: options.fp64 !== undefined ? options.fp64 : false
      }
    });
  } catch (errMsg) {
    throw new Error(`Error parsing LAS/LAZ data -> ${errMsg}`);
  }

  {
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
        const totalChunks = pointsChunks.length;
        for (let j = 0; j < totalChunks; j++) {
          // One yield per chunk — each chunk is up to 20 000
          // points + a SceneGeometry/Mesh creation, so this is
          // the natural granularity for the bar to track.
          await step("Building point chunks", j, totalChunks);
          const geometryId = `geometry-${j}`;
          const geometryResult = sceneModel.createGeometry({
            id: geometryId,
            primitive: PointsPrimitive,
            positions: pointsChunks[j],
            colorsCompressed: colorsChunks[j]
          });
          if (geometryResult.ok===false) {
            log(`[ERROR] Cannot load point cloud -> geometryResult.error}`);
          } else {
            const meshId = `mesh-${j}`;
            meshIds.push(meshId);
            const meshResult = sceneModel.createMesh({
              id: meshId,
              geometryId
            });
            if (meshResult.ok===false) {
              log(`[ERROR] Cannot load point cloud -> meshResult.error}`);
            }
          }
        }
        sceneModel.createObject({
          id: entityId,
          meshIds,
          layerId: options.layerId
        });
        emit("Building point chunks", totalChunks, totalChunks);
      }
      if (dataModel) {
        const rootMetaObjectId = createUUID();
        dataModel.createObject({
          id: rootMetaObjectId,
          type: "BasicEntity",
          name: "Model",
        });
        dataModel.createObject({
          id: entityId,
          type: "BasicEntity",
          name: "PointCloud (LAZ)",
        });
        dataModel.createRelationship({
          type: "BasicAggregation",
          relatingObjectId: rootMetaObjectId,
          relatedObjectId: entityId
        });
      }
    }

    function readPositions(positionsValue) {
      if (positionsValue) {
        if (options.center) {
          const centerPos = createVec3Float64();
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
          const mat = createMat4Float64(options.transform);
          const pos = createVec3Float64();
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
}
