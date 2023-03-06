import {Data} from "@xeokit/data";
import * as basicTypes from "@xeokit/datatypes/basicTypes";

describe('build', function () {

    const data = new Data();

    let dataModel;
    let tablePropertySet;
    let property;
    let legPropertySet;
    let dataObject1;

    it('create data model', function () {
        dataModel = data.createModel({
            id: "myModel"
        });
        expect(data.models["myModel"]).toBe(dataModel);
    });

    it('create property set', function () {
        tablePropertySet = dataModel.createPropertySet({
            id: "tablePropertySet",
            name: "Table properties",
            type: ""
        });
        expect(dataModel.propertySets["tablePropertySet"]).toBe(tablePropertySet);
    });

    it('create property 1', function () {
        property = tablePropertySet.createProperty({
            name: "Weight",
            value: 5,
            type: "",
            valueType: "",
            description: "Weight of the thing"
        });
        expect(tablePropertySet.properties[0]).toBe(property);
    });

    it('create property 2', function () {
        property = tablePropertySet.createProperty({
            name: "Height",
            value: 12,
            type: "",
            valueType: "",
            description: "Height of the thing"
        });
        expect(tablePropertySet.properties[tablePropertySet.properties.length-1]).toBe(property);
    });

    it('create property set 2', function () {
        legPropertySet = dataModel.createPropertySet({
            id: "legPropertySet",
            name: "Table leg properties",
            type: ""
        });
        expect(dataModel.propertySets["legPropertySet"]).toBe(legPropertySet);
    });

    it('create property', function () {
        const property = legPropertySet.createProperty({
            name: "Weight",
            value: 5,
            type: "",
            valueType: "",
            description: "Weight of the thing"
        });
        expect(legPropertySet.properties[legPropertySet.properties.length - 1]).toBe(property);
    });

    it('create DataObject', function () {
        dataObject1 = dataModel.createObject({
            id: "table",
            type: basicTypes.BasicEntity,
            name: "Table",
            propertySetIds: ["tablePropertySet"]
        });
        expect(dataModel.objects[dataObject1.id]).toBe(dataObject1);
    });

    /*
    dataModel.createObject({
        id: "redLeg",
        name: "Red table Leg",
        type: basicTypes.BasicEntity,
        propertySetIds: ["tableLegPropertySet"]
    });

    dataModel.createObject({
        id: "greenLeg",
        name: "Green table leg",
        type: basicTypes.BasicEntity,
        propertySetIds: ["tableLegPropertySet"]
    });

    dataModel.createObject({
        id: "blueLeg",
        name: "Blue table leg",
        type: basicTypes.BasicEntity,
        propertySetIds: ["tableLegPropertySet"]
    });

    dataModel.createObject({
        id: "yellowLeg",
        name: "Yellow table leg",
        type: "leg",
        propertySetIds: ["tableLegPropertySet"]
    });

    dataModel.createObject({
        id: "tableTop",
        name: "Purple table top",
        type: basicTypes.BasicEntity,
        propertySetIds: ["tableTopPropertySet"]
    });

    dataModel.createRelationship({
        type: basicTypes.BasicAggregation,
        relating: "table",
        related: "tableTop"
    });

    dataModel.createRelationship({
        type: basicTypes.BasicAggregation,
        relating: "tableTop",
        related: "redLeg"
    });

    dataModel.createRelationship({
        type: basicTypes.BasicAggregation,
        relating: "tableTop",
        related: "greenLeg"
    });

    dataModel.createRelationship({
        type: basicTypes.BasicAggregation,
        relating: "tableTop",
        related: "blueLeg"
    });

    dataModel.createRelationship({
        type: basicTypes.BasicAggregation,
        relating: "tableTop",
        related: "yellowLeg"
    });

    dataModel.build();
    it('create uncompressed geometry', function () {
        geometry = model.createObject({
            id: "myModel"
        });
        expect(data.models["myModel"]).toBe(model);
    });

     */
});