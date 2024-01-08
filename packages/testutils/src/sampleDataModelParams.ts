import {BasicAggregation, BasicEntity} from "@xeokit/basictypes";

/**
 * Mock JSON-encoded DataModel definition.
 */
export const sampleDataModelParams = { // DataModel
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
