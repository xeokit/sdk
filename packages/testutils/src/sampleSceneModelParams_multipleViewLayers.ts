import {TrianglesPrimitive} from "@xeokit/constants";

/**
 * Mock JSON-encoded SceneModel definition.
 */
export const sampleSceneModelParams_multipleViewLayers = {
    id: "myModel",
    geometries: [
        {
            id: "myBoxGeometry",
            primitive: TrianglesPrimitive,
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
            id: "redLeg-mesh",
            geometryId: "myBoxGeometry",
            position: [-4, -6, -4],
            scale: [1, 3, 1],
            rotation: [0, 0, 0],
            color: [1, 0.3, 0.3],
            //textureSetId: "myTextureSet"
        },
        {
            id: "greenLeg-mesh",
            geometryId: "myBoxGeometry",
            position: [4, -6, -4],
            scale: [1, 3, 1],
            rotation: [0, 0, 0],
            color: [0.3, 1.0, 0.3],
            //textureSetId: "myTextureSet"
        },
        {
            id: "blueLeg-mesh",
            geometryId: "myBoxGeometry",
            position: [4, -6, 4],
            scale: [1, 3, 1],
            rotation: [0, 0, 0],
            color: [0.3, 0.3, 1.0],
            //  textureSetId: "myTextureSet"
        },
        {
            id: "yellowLeg-mesh",
            geometryId: "myBoxGeometry",
            position: [-4, -6, 4],
            scale: [1, 3, 1],
            rotation: [0, 0, 0],
            color: [1.0, 1.0, 0.0],
            // textureSetId: "myTextureSet"
        },
        {
            id: "tableTop-mesh",
            geometryId: "myBoxGeometry",
            position: [0, -3, 0],
            scale: [6, 0.5, 6],
            rotation: [0, 0, 0],
            color: [1.0, 0.3, 1.0],
            // textureSetId: "myTextureSet"
        }
    ],
    objects: [
        {
            id: "redLeg",
            meshIds: ["redLeg-mesh"],
            layerId: "default"
        },
        {
            id: "greenLeg",
            meshIds: ["greenLeg-mesh"],
            layerId: "viewLayer2"
        },
        {
            id: "blueLeg",
            meshIds: ["blueLeg-mesh"],
            layerId: "viewLayer2"
        },
        {
            id: "yellowLeg",
            meshIds: ["yellowLeg-mesh"],
            layerId: "viewLayer2"
        },
        {
            id: "tableTop",
            meshIds: ["tableTop-mesh"],
            layerId: "viewLayer2"
        }]
};