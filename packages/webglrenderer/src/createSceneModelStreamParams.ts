import { SceneModel, SceneModelStreamParams} from "@xeokit/scene";
import {LinesPrimitive, TrianglesPrimitive} from "@xeokit/constants";


/**
 * 12-bits allowed for object ids.
 * Limits the per-mesh texture height in the layer.
 */
const MAX_MESHES_IN_LAYER = (1 << 16);

/**
 * 4096 is max data texture height.
 * Limits the aggregated geometry texture height in the layer.
 */
const MAX_DATA_TEXTURE_HEIGHT = 1 << 16;

/**
 * Enables a {@link @xeokit/scene!SceneModel} to be progressively loaded
 * into {@link @xeokit/viewer!Viewer | Viewer} that's configured with a {@link @xeokit/webglrenderer!WebGLRenderer}.
 *
 * @param sceneModel
 */
export function createSceneModelStreamParams(sceneModel: SceneModel) {

    const layersBeingBuilt = {};
    const layerList = [];
    let layerIndex = 0;

    Object.entries(sceneModel.objects).forEach(([objectId, sceneObject]) => {

        for (const sceneMesh of sceneObject.meshes) {

            const sceneGeometry = sceneMesh.geometry;
            const textureSetId = sceneMesh.textureSet ? sceneMesh.textureSet.id : "";
            const origin = sceneMesh.origin || [0, 0, 0];
            const layerId = `${textureSetId}.${sceneGeometry.primitive}.${Math.round(origin[0])}.${Math.round(origin[1])}.${Math.round(origin[2])}`;

            let layer = layersBeingBuilt[layerId];

            let canCreate = false;

            while (!canCreate) {

                if (!layer) {
                    layerIndex = layerList.length;
                    layer = {
                        layerIndex,
                        hasBucket: {},
                        numSubMeshes: 0,
                        numVertices: 0,
                        numIndices8Bits: 0,
                        numIndices16Bits: 0,
                        numIndices32Bits: 0
                    };
                    layerList.push(layer);
                    layersBeingBuilt[layerId] = layer;
                }

                const indicesPerPrimitive = sceneGeometry.primitive === TrianglesPrimitive ? 3 : (LinesPrimitive ? 2 : 1); // TODO

                const numSubMeshesToCreate = sceneGeometry.geometryBuckets.length;

                canCreate = (layer.numSubMeshes + numSubMeshesToCreate) <= MAX_MESHES_IN_LAYER;

                const bucketIndex = 0; // TODO: Is this a bug?
                const bucketId = `${sceneGeometry.id}#${bucketIndex}`;
                const layerHasBucket = layer.hasBucket[bucketId];

                if (!layerHasBucket) {

                    const maxExistingIndicesOfAnyBits = Math.max(layer.numIndices8Bits, layer.numIndices16Bits, layer.numIndices32Bits);

                    let numVerticesToCreate = 0;
                    let numIndicesToCreate = 0;

                    sceneGeometry.geometryBuckets.forEach(bucket => {
                        numVerticesToCreate += bucket.positionsCompressed.length / indicesPerPrimitive;
                        numIndicesToCreate += bucket.indices.length / indicesPerPrimitive;
                    });

                    canCreate &&=
                        (layer.numVertices + numVerticesToCreate) <= MAX_DATA_TEXTURE_HEIGHT * 4096 &&
                        (maxExistingIndicesOfAnyBits + numIndicesToCreate) <= MAX_DATA_TEXTURE_HEIGHT * 4096;

                    if (canCreate) {

                        layer.numSubMeshes++;
                        layer.numVertices += numVerticesToCreate;

                        // TODO
                        // layer.numIndices8Bits

                        layer.hasBucket[bucketId] = true;
                    }
                }

                if (canCreate) {
                    sceneMesh.streamLayerIndex = layerIndex;
                } else { // Layer is full
                    delete layersBeingBuilt[layerId];
                    layer = null;
                }
            }
        }
    });

    const streamParams: SceneModelStreamParams = {
        streamLayers: []
    };

    for (let i = 0, len = layerList.length; i < len; i++) {
        const layer = layerList[i];
        streamParams.streamLayers.push({
            numSubMeshes: layer.numSubMeshes,
            numVertices: layer.numVertices,
            numIndices8Bits: layer.numIndices8Bits,
            numIndices16Bits: layer.numIndices16Bits,
            numIndices32Bits: layer.numIndices32Bits
        });
    }

    sceneModel.streamParams = streamParams;
}
