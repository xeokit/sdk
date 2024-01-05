import {Data} from "../src";
import {BasicAggregation, BasicEntity} from "@xeokit/basictypes";
import {SDKError} from "@xeokit/core";

describe('DataModel', function () {

    const data = new Data();

    it('supports adding objects, property sets and relationships in separate JSON parts', () => {

        const dataModel = data.createModel({ // DataModelParams
            id: "myTableModel"
        });

        if (dataModel instanceof SDKError) {
            return;
        }

        const result = dataModel.fromJSON({ // DataModelContentParams
            propertySets: [
                {
                    id: "tablePropertySet",
                    name: "Table properties",
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
                            value: 5,
                            type: "",
                            valueType: "",
                            description: "Weight of the thing"
                        }, {
                            name: "Height",
                            value: 12,
                            type: "",
                            valueType: "",
                            description: "Height of the thing"
                        }
                    ]
                }
            ],
            objects: [
                {
                    id: "table",
                    type: BasicEntity,
                    name: "Table",
                    propertySetIds: ["tablePropertySet"]
                },
                {
                    id: "tableTop",
                    name: "Purple table top",
                    type: BasicEntity,
                    propertySetIds: ["tableTopPropertySet"]
                }
            ],
            relationships: [
                {
                    type: BasicAggregation,
                    relatingObjectId: "table",
                    relatedObjectId: "tableTop"
                }
            ]
        });

        if (result instanceof SDKError) {
            return;
        }

        const result2 = dataModel.fromJSON({ // DataModelContentParams
            propertySets: [
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
                }
            ],
            objects: [
                {
                    id: "redLeg",
                    name: "Red table Leg",
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
                }
            ],
            relationships: [
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
            ]
        });

        if (result2 instanceof SDKError) {
            return;
        }

        dataModel.build();

        expect(dataModel.built).toBe(true);

        expect(data.models["myTableModel"]).toBe(dataModel);

        // Objects created OK?

        const tableTop = data.objects["tableTop"]; // Find object on Data
        expect(tableTop).toBeDefined();
        expect(tableTop.id).toBe("tableTop");
        expect(tableTop.name).toBe("Purple table top");
        expect(tableTop.type).toBe(BasicEntity);

        const tableTop2 = dataModel.objects["tableTop"]; // Find object on DataModel
        expect(tableTop2).toBeDefined();
        expect(tableTop2).toBe(tableTop);

        const table = data.objects["table"];
        expect(table).toBeDefined();
        expect(table.id).toBe("table");
        expect(table.name).toBe("Table");
        expect(table.type).toBe(BasicEntity);

        const redLeg = data.objects["redLeg"];
        expect(redLeg).toBeDefined();
        expect(redLeg.id).toBe("redLeg");
        expect(redLeg.name).toBe("Red table Leg");
        expect(redLeg.type).toBe(BasicEntity);

        const greenLeg = data.objects["greenLeg"];
        expect(greenLeg).toBeDefined();
        expect(greenLeg.id).toBe("greenLeg");
        expect(greenLeg.name).toBe("Green table leg");
        expect(greenLeg.type).toBe(BasicEntity);

        const yellowLeg = data.objects["yellowLeg"];
        expect(yellowLeg).toBeDefined();
        expect(yellowLeg.id).toBe("yellowLeg");
        expect(yellowLeg.name).toBe("Yellow table leg");
        expect(yellowLeg.type).toBe(BasicEntity);

        const blueLeg = data.objects["blueLeg"];
        expect(blueLeg).toBeDefined();
        expect(blueLeg.id).toBe("blueLeg");
        expect(blueLeg.name).toBe("Blue table leg");
        expect(blueLeg.type).toBe(BasicEntity);

        // Properties created OK?

        const _tablePropertySet = dataModel.propertySets["tablePropertySet"];
        expect(_tablePropertySet).toBeDefined();
        expect(_tablePropertySet.id).toBe("tablePropertySet");
        expect(_tablePropertySet.name).toBe("Table properties");
        expect(_tablePropertySet.type).toBe("");

        expect(_tablePropertySet.properties).toBeDefined();
        expect(_tablePropertySet.properties[0]).toBeDefined();
        expect(_tablePropertySet.properties[0].name).toBe("Weight");
        expect(_tablePropertySet.properties[0].description).toBe("Weight of the thing");
        expect(_tablePropertySet.properties[0].value).toBe(5);
        expect(_tablePropertySet.properties[0].valueType).toBe("");
        expect(_tablePropertySet.properties[0].type).toBe("");

        expect(_tablePropertySet.properties[1]).toBeDefined();
        expect(_tablePropertySet.properties[1].name).toBe("Height");
        expect(_tablePropertySet.properties[1].description).toBe("Height of the thing");
        expect(_tablePropertySet.properties[1].value).toBe(12);
        expect(_tablePropertySet.properties[1].valueType).toBe("");
        expect(_tablePropertySet.properties[1].type).toBe("");

        const tableLegPropertySet = dataModel.propertySets["tableLegPropertySet"];
        expect(tableLegPropertySet).toBeDefined();
        expect(tableLegPropertySet.id).toBe("tableLegPropertySet");
        expect(tableLegPropertySet.name).toBe("Table leg properties");
        expect(tableLegPropertySet.type).toBe("");

        expect(tableLegPropertySet.properties).toBeDefined();
        expect(tableLegPropertySet.properties[0]).toBeDefined();
        expect(tableLegPropertySet.properties[0].name).toBe("Weight");
        expect(tableLegPropertySet.properties[0].description).toBe("Weight of the thing");
        expect(tableLegPropertySet.properties[0].value).toBe(5);
        expect(tableLegPropertySet.properties[0].valueType).toBe("");
        expect(tableLegPropertySet.properties[0].type).toBe("");

        expect(tableLegPropertySet.properties[1]).toBeDefined();
        expect(tableLegPropertySet.properties[1].name).toBe("Height");
        expect(tableLegPropertySet.properties[1].description).toBe("Height of the thing");
        expect(tableLegPropertySet.properties[1].value).toBe(12);
        expect(tableLegPropertySet.properties[1].valueType).toBe("");
        expect(tableLegPropertySet.properties[1].type).toBe("");

        const _tableTopPropertySet = dataModel.propertySets["tableTopPropertySet"];
        expect(_tableTopPropertySet).toBeDefined();
        expect(_tableTopPropertySet.id).toBe("tableTopPropertySet");
        expect(_tableTopPropertySet.name).toBe("Table top properties");
        expect(_tableTopPropertySet.type).toBe("");

        expect(_tableTopPropertySet.properties).toBeDefined();
        expect(_tableTopPropertySet.properties[0]).toBeDefined();
        expect(_tableTopPropertySet.properties[0].name).toBe("Weight");
        expect(_tableTopPropertySet.properties[0].description).toBe("Weight of the thing");
        expect(_tableTopPropertySet.properties[0].value).toBe(5);
        expect(_tableTopPropertySet.properties[0].valueType).toBe("");
        expect(_tableTopPropertySet.properties[0].type).toBe("");

        expect(_tableTopPropertySet.properties[1]).toBeDefined();
        expect(_tableTopPropertySet.properties[1].name).toBe("Height");
        expect(_tableTopPropertySet.properties[1].description).toBe("Height of the thing");
        expect(_tableTopPropertySet.properties[1].value).toBe(12);
        expect(_tableTopPropertySet.properties[1].valueType).toBe("");
        expect(_tableTopPropertySet.properties[1].type).toBe("");

        // Relationships created OK?

        const tableAggregations = dataModel.objects["table"].related[BasicAggregation];
        expect(tableAggregations).toBeDefined();
        expect(tableAggregations[0].type).toBe(BasicAggregation);
        expect(tableAggregations[0].relatingObject.id).toBe("table");
        expect(tableAggregations[0].relatedObject.id).toBe("tableTop");

        const tableTopAggregations = dataModel.objects["tableTop"].related[BasicAggregation];
        expect(tableTopAggregations).toBeDefined();

        expect(tableTopAggregations[0].type).toBe(BasicAggregation);
        expect(tableTopAggregations[0].relatingObject.id).toBe("tableTop");
        expect(tableTopAggregations[0].relatedObject.id).toBe("redLeg");

        expect(tableTopAggregations[1].type).toBe(BasicAggregation);
        expect(tableTopAggregations[1].relatingObject.id).toBe("tableTop");
        expect(tableTopAggregations[1].relatedObject.id).toBe("greenLeg");

        expect(tableTopAggregations[2].type).toBe(BasicAggregation);
        expect(tableTopAggregations[2].relatingObject.id).toBe("tableTop");
        expect(tableTopAggregations[2].relatedObject.id).toBe("blueLeg");

        expect(tableTopAggregations[3].type).toBe(BasicAggregation);
        expect(tableTopAggregations[3].relatingObject.id).toBe("tableTop");
        expect(tableTopAggregations[3].relatedObject.id).toBe("yellowLeg");

        // Does the DataModel serialize correctly to JSON?

        // const dataModelJSON = dataModel.getJSON();
        // console.log(JSON.stringify(dataModelJSON, null, "\t"));
        // expect(testUtils.deepEquals(testUtils.sampleDataModelJSON, dataModelJSON)).toBe(true);

        dataModel.destroy();

        expect(dataModel.destroyed).toBe(true);
        expect(data.models["myTableModel"]).toBeUndefined();
    })
    ;

})
;