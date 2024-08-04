import {SceneModel, SceneModelStreamParams} from "@xeokit/scene";
import {LinesPrimitive, TrianglesPrimitive} from "@xeokit/constants";


/**
 * Enables a {@link @xeokit/scene!SceneModel | SceneModel} to be progressively loaded
 * into {@link @xeokit/viewer!Viewer | Viewer} that's configured with a {@link @xeokit/webglrenderer!WebGLRenderer | WebGLRenderer}.
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
            const tile = sceneMesh.tile;
            const layerId = `${textureSetId}.${sceneGeometry.primitive}.${tile.id}`;

            let layer = layersBeingBuilt[layerId];

            let canCreate = false;

            while (!canCreate) {
                if (!layer) {
                    layerIndex = layerList.length;
                    layer = {
                        layerIndex,
                        numMeshes: 0,
                        numVertices: 0,
                        numIndices: 0
                    };
                    layerList.push(layer);
                    layersBeingBuilt[layerId] = layer;
                }

                const indicesPerPrimitive = sceneGeometry.primitive === TrianglesPrimitive ? 3 : (LinesPrimitive ? 2 : 1); // TODO
                const numExistingIndices = layer.numIndices;
                const numVerticesToCreate = sceneGeometry.positionsCompressed.length / indicesPerPrimitive;
                const numIndicesToCreate = sceneGeometry.indices.length / indicesPerPrimitive;

                canCreate =
                    (layer.numVertices + numVerticesToCreate) <= 500000 * 4096 &&
                    (numExistingIndices + numIndicesToCreate) <= 500000;

                if (canCreate) {
                    layer.numMeshes++;
                    layer.numVertices += numVerticesToCreate;
                    // TODO
                }
            }

            if (canCreate) {
                sceneMesh.streamLayerIndex = layerIndex;
            } else { // Layer is full
                delete layersBeingBuilt[layerId];
                layer = null;
            }
        }
    });

    const streamParams: SceneModelStreamParams = {
        streamLayers: []
    };

    for (let i = 0, len = layerList.length; i < len; i++) {
        const layer = layerList[i];
        streamParams.streamLayers.push({
            numLayerMeshes: layer.numLayerMeshes,
            numVertices: layer.numVertices,
            numIndices: layer.numIndices
        });
    }

    sceneModel.streamParams = streamParams;
}
