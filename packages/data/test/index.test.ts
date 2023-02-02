import {Data} from "@xeokit/data";

const myData = new Data();

const mySchema = {
    MOUSE_TYPE: 0,
    CAT_TYPE: 1,
    CHASES_REL: 2
};

let myDataModel;

describe('DataModel building tests', () => {
    test('Creating a DataModel', () => {

        myDataModel = myData.createModel({
            id: "myModel"
        });

        myDataModel.createObject({
            id: "tom",
            name: "Tom",
            type: mySchema.CAT_TYPE
        });

        myDataModel.createObject({
            id: "jerry",
            name: "Jerry",
            type: mySchema.MOUSE_TYPE
        });

        myDataModel.createRelationship({
            type: mySchema.CHASES_REL,
            relatingObjectId: "tom",
            relatedObjectId: "jerry"
        });

        myDataModel.build(); // Ready for use now

        expect(!!myData.models["myDataModel"]).toBe(true);
        expect(!!myData.objects["tom"]).toBe(true);
        expect(!!myDataModel.objects["tom"]).toBe(true);
        expect(!!myData.objects["jerry"]).toBe(true);
        expect(!!myDataModel.objects["jerry"]).toBe(true);

        const tom = myData.objects["tom"];
        const jerry = myData.objects["jerry"];


        expect(!!tom.related["jerry"]).toBe(true);

        const relation = tom.related["jerry"]

        expect(relation.)
    });
});



