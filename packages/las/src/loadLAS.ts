import type {SceneModel} from "@xeokit/scene";
import type {DataModel} from "@xeokit/data";
import {SDKError} from "@xeokit/core";
import {createMat4, createVec3, transformPoint3} from "@xeokit/matrix";
import {BasicAggregation, BasicEntity} from "@xeokit/basictypes";
import {createUUID} from "@xeokit/utils";
import {PointsPrimitive} from "@xeokit/constants";
import {parse} from '@loaders.gl/core';
import {LASLoader} from '@loaders.gl/las';
import {FloatArrayParam} from "@xeokit/math";

const MAX_VERTICES = 500000; // TODO: Rough estimate

/**
 * Loads LAS/LAZ file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/las"} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - LAS/LAZ file data
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - Loading parameters.
 * @param options.center - Whether to center the points. Default is false.
 * @param options.transform - Optional flattened 4x4 matrix to transform the points. Applied after centering, if specified.
 * @param options.skip - Option to oad every **n** points. Default is 1.
 * @param options.fp64 - Whether to assume that LAS positions are stored in 64-bit floats instead of 32-bit. Default is true.
 * @param options.colorDepth - Whether to assume that LAS colors are encoded using 8 or 16 bits. Accepted values are 8, 16 an "auto".
 * @returns {Promise} Resolves when LAS has been loaded.
 * @throws *{@link @xeokit/core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export function loadLAS(params: {
                            fileData: ArrayBuffer,
                            sceneModel: SceneModel,
                            dataModel?: DataModel,
                            log?: Function
                        },
                        options: {
                            center?: boolean;
                            transform?: FloatArrayParam;
                            skip?: number;
                            fp64?: boolean;
                            colorDepth?: string | number,
                        }={}): Promise<any> {

    return new Promise<void>(function (resolve, reject) {

        const dataModel = params.dataModel;
        const sceneModel = params.sceneModel;

        if (sceneModel?.destroyed) {
            throw new SDKError("SceneModel already destroyed");
        }

        if (sceneModel?.built) {
            throw new SDKError("SceneModel already built");
        }

        if (dataModel?.destroyed) {
            throw new SDKError("DataModel already destroyed");
        }

        if (dataModel?.built) {
            throw new SDKError("DataModel already built");
        }

        const skip = options.skip || 1;

        const log = (msg) => {
            if (params.log) {
                params.log(msg);
            }
        }

        parse(params.fileData, LASLoader, {
            las: {
                colorDepth: options.colorDepth || "auto",
                fp64: options.fp64 !== undefined ? options.fp64 : false
            }

        }).then((parsedData) => {

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

            const meshIds = [];

            for (let j = 0, lenj = pointsChunks.length; j < lenj; j++) {

                const geometryId = `geometry-${j}`;

                const geometry = sceneModel.createGeometry({
                    id: geometryId,
                    primitive: PointsPrimitive,
                    positions: pointsChunks[j],
                    colors: colorsChunks[j]
                });

                if (geometry instanceof SDKError) {
                    log(`[ERROR] Failed to load point cloud: ${geometry.message}`);
                } else {

                    const meshId = `mesh-${j}`;
                    meshIds.push(meshId);

                    const mesh = sceneModel.createMesh({
                        id: meshId,
                        geometryId
                    });

                    if (mesh instanceof SDKError) {
                        log(`[ERROR] Failed to load point cloud: ${mesh.message}`);
                    }
                }
            }

            const entityId = createUUID();

            sceneModel.createObject({
                id: entityId,
                meshIds
            });

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
            reject(errMsg);
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
            let result = [];
            for (let i = 0; i < array.length; i += chunkSize) {
                result.push(array.slice(i, i + chunkSize));
            }
            return result;
        }
    });
}
