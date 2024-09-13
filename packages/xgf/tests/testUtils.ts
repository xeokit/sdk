import {BasicAggregation, BasicEntity} from "@xeokit/basictypes";
import {TrianglesPrimitive} from "@xeokit/constants";

/**
 * Mock JSON-encoded SceneModel definition.
 */
export const sampleSceneModelJSON = {
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
            id: "redLegMesh",
            geometryId: "myBoxGeometry",
            position: [-4, -6, -4],
            scale: [1, 3, 1],
            rotation: [0, 0, 0],
            color: [1, 0.3, 0.3],
            //textureSetId: "myTextureSet"
        },
        {
            id: "greenLegMesh",
            geometryId: "myBoxGeometry",
            position: [4, -6, -4],
            scale: [1, 3, 1],
            rotation: [0, 0, 0],
            color: [0.3, 1.0, 0.3],
            //textureSetId: "myTextureSet"
        },
        {
            id: "blueLegMesh",
            geometryId: "myBoxGeometry",
            position: [4, -6, 4],
            scale: [1, 3, 1],
            rotation: [0, 0, 0],
            color: [0.3, 0.3, 1.0],
            //  textureSetId: "myTextureSet"
        },
        {
            id: "yellowLegMesh",
            geometryId: "myBoxGeometry",
            position: [-4, -6, 4],
            scale: [1, 3, 1],
            rotation: [0, 0, 0],
            color: [1.0, 1.0, 0.0],
            // textureSetId: "myTextureSet"
        },
        {
            id: "tableTopMesh",
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
            meshIds: ["redLegMesh"]
        },
        {
            id: "greenLeg",
            meshIds: ["greenLegMesh"]
        },
        {
            id: "blueLeg",
            meshIds: ["blueLegMesh"]
        },
        {
            id: "yellowLeg",
            meshIds: ["yellowLegMesh"]
        },
        {
            id: "tableTop",
            meshIds: ["tableTopMesh"]
        }]
};

/**
 * Mock JSON-encoded DataModel definition.
 */
export const sampleDataModelJSON = { // DataModel
    id: "myModel",
    objects: [ // DataObject[]
        {
            id: "table",
            type: BasicEntity,
            name: "Table",
            propertySetIds: ["tablePropertySet"]
        },
        {
            id: "redLeg",
            name: "Red table leg",
            type: BasicEntity,
            propertySetIds: ["tableLegPropertySet"]
        },
        {
            id: "greenLeg",
            name: "Green table leg",
            type: BasicEntity,
            propertySetIds: ["tableLegPropertySet"]
        },
        {
            id: "blueLeg",
            name: "Blue table leg",
            type: BasicEntity,
            propertySetIds: ["tableLegPropertySet"]
        },
        {
            id: "yellowLeg",
            name: "Yellow table leg",
            type: BasicEntity,
            propertySetIds: ["tableLegPropertySet"]
        },
        {
            id: "tableTop",
            name: "Purple table top",
            type: BasicEntity,
            propertySetIds: ["tableTopPropertySet"]
        }
    ],
    relationships: [ // Relationship[]
        {
            type: BasicAggregation,
            relatingObjectId: "table",
            relatedObjectId: "tableTop"
        },
        {
            type: BasicAggregation,
            relatingObjectId: "tableTop",
            relatedObjectId: "redLeg"
        },
        {
            type: BasicAggregation,
            relatingObjectId: "tableTop",
            relatedObjectId: "greenLeg"
        },
        {
            type: BasicAggregation,
            relatingObjectId: "tableTop",
            relatedObjectId: "blueLeg"
        },
        {
            type: BasicAggregation,
            relatingObjectId: "tableTop",
            relatedObjectId: "yellowLeg"
        }
    ],
    propertySets: [ // PropertySet[]
        {
            id: "tablePropertySet",
            name: "Table properties",
            type: "",
            properties: [ // Property[]
                {
                    name: "Weight",
                    value: 5,
                    type: "",
                    valueType: "",
                    description: "Weight of the thing"
                },
                {
                    name: "Height",
                    value: 12,
                    type: "",
                    valueType: "",
                    description: "Height of the thing"
                }
            ]
        },
        {
            id: "tableLegPropertySet",
            name: "Table leg properties",
            type: "",
            properties: [
                {
                    name: "Weight",
                    value: 5,
                    type: "",
                    valueType: "",
                    description: "Weight of the thing"
                },
                {
                    name: "Height",
                    value: 12,
                    type: "",
                    valueType: "",
                    description: "Height of the thing"
                }
            ]
        },
        {
            id: "tableTopPropertySet",
            name: "Table top properties",
            type: "",
            properties: [
                {
                    name: "Weight",
                    value: 15,
                    type: "",
                    valueType: "",
                    description: "Weight of the thing"
                },
                {
                    name: "Height",
                    value: 4,
                    type: "",
                    valueType: "",
                    description: "Height of the thing"
                }
            ]
        }
    ]
};
