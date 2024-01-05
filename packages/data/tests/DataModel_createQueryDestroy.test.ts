import {Data} from "../src";
import * as testUtils from "./testUtils";

describe('DataModel', function () {

    const data = new Data();
    let dataModel;

    it('it supports creating objects, property sets and relations from JSON', () => {

        dataModel = data.createModel(testUtils.sampleDataModelJSON);

        dataModel.build();

        expect(dataModel.built).toBe(true);

        expect(data.models["myTableModel"]).toBe(dataModel);

        // Objects created OK?

        const tableTop = data.objects["tableTop"]; // Find object on Data
        expect(tableTop).toBeDefined();
        expect(tableTop.id).toBe("tableTop");
        expect(tableTop.name).toBe("Purple table top");
        expect(tableTop.type).toBe(testUtils.BasicEntity);

        const tableTop2 = dataModel.objects["tableTop"]; // Find object on DataModel
        expect(tableTop2).toBeDefined();
        expect(tableTop2).toBe(tableTop);

        const table = data.objects["table"];
        expect(table).toBeDefined();
        expect(table.id).toBe("table");
        expect(table.name).toBe("Table");
        expect(table.type).toBe(testUtils.BasicEntity);

        const redLeg = data.objects["redLeg"];
        expect(redLeg).toBeDefined();
        expect(redLeg.id).toBe("redLeg");
        expect(redLeg.name).toBe("Red table leg");
        expect(redLeg.type).toBe(testUtils.LoadBearingEntity);

        const greenLeg = data.objects["greenLeg"];
        expect(greenLeg).toBeDefined();
        expect(greenLeg.id).toBe("greenLeg");
        expect(greenLeg.name).toBe("Green table leg");
        expect(greenLeg.type).toBe(testUtils.LoadBearingEntity);

        const yellowLeg = data.objects["yellowLeg"];
        expect(yellowLeg).toBeDefined();
        expect(yellowLeg.id).toBe("yellowLeg");
        expect(yellowLeg.name).toBe("Yellow table leg");
        expect(yellowLeg.type).toBe(testUtils.LoadBearingEntity);

        const blueLeg = data.objects["blueLeg"];
        expect(blueLeg).toBeDefined();
        expect(blueLeg.id).toBe("blueLeg");
        expect(blueLeg.name).toBe("Blue table leg");
        expect(blueLeg.type).toBe(testUtils.LoadBearingEntity);

        // Properties created OK?

        const tablePropertySet = dataModel.propertySets["tablePropertySet"];
        expect(tablePropertySet).toBeDefined();
        expect(tablePropertySet.id).toBe("tablePropertySet");
        expect(tablePropertySet.name).toBe("Table properties");
        expect(tablePropertySet.type).toBe("");

        expect(tablePropertySet.properties).toBeDefined();
        expect(tablePropertySet.properties[0]).toBeDefined();
        expect(tablePropertySet.properties[0].name).toBe("Weight");
        expect(tablePropertySet.properties[0].description).toBe("Weight of the thing");
        expect(tablePropertySet.properties[0].value).toBe(5);
        expect(tablePropertySet.properties[0].valueType).toBe("");
        expect(tablePropertySet.properties[0].type).toBe("");

        expect(tablePropertySet.properties[1]).toBeDefined();
        expect(tablePropertySet.properties[1].name).toBe("Height");
        expect(tablePropertySet.properties[1].description).toBe("Height of the thing");
        expect(tablePropertySet.properties[1].value).toBe(12);
        expect(tablePropertySet.properties[1].valueType).toBe("");
        expect(tablePropertySet.properties[1].type).toBe("");

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

        const tableTopPropertySet = dataModel.propertySets["tableTopPropertySet"];
        expect(tableTopPropertySet).toBeDefined();
        expect(tableTopPropertySet.id).toBe("tableTopPropertySet");
        expect(tableTopPropertySet.name).toBe("Table top properties");
        expect(tableTopPropertySet.type).toBe("");

        expect(tableTopPropertySet.properties).toBeDefined();
        expect(tableTopPropertySet.properties[0]).toBeDefined();
        expect(tableTopPropertySet.properties[0].name).toBe("Weight");
        expect(tableTopPropertySet.properties[0].description).toBe("Weight of the thing");
        expect(tableTopPropertySet.properties[0].value).toBe(15);
        expect(tableTopPropertySet.properties[0].valueType).toBe("");
        expect(tableTopPropertySet.properties[0].type).toBe("");

        expect(tableTopPropertySet.properties[1]).toBeDefined();
        expect(tableTopPropertySet.properties[1].name).toBe("Height");
        expect(tableTopPropertySet.properties[1].description).toBe("Height of the thing");
        expect(tableTopPropertySet.properties[1].value).toBe(4);
        expect(tableTopPropertySet.properties[1].valueType).toBe("");
        expect(tableTopPropertySet.properties[1].type).toBe("");

        // Relationships created OK?

        const tableAggregations = dataModel.objects["table"].related[testUtils.BasicAggregation];
        expect(tableAggregations).toBeDefined();
        expect(tableAggregations[0].type).toBe(testUtils.BasicAggregation);
        expect(tableAggregations[0].relatingObject.id).toBe("table");
        expect(tableAggregations[0].relatedObject.id).toBe("tableTop");

        const tableTopAggregations = dataModel.objects["tableTop"].related[testUtils.BasicAggregation];
        expect(tableTopAggregations).toBeDefined();

        expect(tableTopAggregations[0].type).toBe(testUtils.BasicAggregation);
        expect(tableTopAggregations[0].relatingObject.id).toBe("tableTop");
        expect(tableTopAggregations[0].relatedObject.id).toBe("redLeg");

        expect(tableTopAggregations[1].type).toBe(testUtils.BasicAggregation);
        expect(tableTopAggregations[1].relatingObject.id).toBe("tableTop");
        expect(tableTopAggregations[1].relatedObject.id).toBe("greenLeg");

        expect(tableTopAggregations[2].type).toBe(testUtils.BasicAggregation);
        expect(tableTopAggregations[2].relatingObject.id).toBe("tableTop");
        expect(tableTopAggregations[2].relatedObject.id).toBe("blueLeg");

        expect(tableTopAggregations[3].type).toBe(testUtils.BasicAggregation);
        expect(tableTopAggregations[3].relatingObject.id).toBe("tableTop");
        expect(tableTopAggregations[3].relatedObject.id).toBe("yellowLeg");

    });

    it('it supports search by traversal along the given relationship types', () => {

        let resultObjectIds = [];
        data.searchObjects({
            startObjectId: "table",
            includeRelated: [testUtils.BasicAggregation],
            resultObjectIds
        });
        expect(resultObjectIds).toStrictEqual(['table', 'tableTop', 'redLeg', 'greenLeg', 'blueLeg', 'yellowLeg']);

        resultObjectIds = [];
        data.searchObjects({
            startObjectId: "table",
            includeStart: false,
            includeRelated: [testUtils.BasicAggregation],
            resultObjectIds
        });
        expect(resultObjectIds).toStrictEqual(['tableTop', 'redLeg', 'greenLeg', 'blueLeg', 'yellowLeg']);

        resultObjectIds = [];
        data.searchObjects({
            startObjectId: "tableTop",
            includeStart: true,
            excludeObjects:[testUtils.BasicEntity],
            includeRelated: [testUtils.BasicAggregation],
            resultObjectIds
        });
        expect(resultObjectIds).toStrictEqual(['redLeg', 'greenLeg', 'blueLeg', 'yellowLeg']);
        dataModel.destroy();

        expect(dataModel.destroyed).toBe(true);
        expect(data.models["myTableModel"]).toBeUndefined();
    });

});