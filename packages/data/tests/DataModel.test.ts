import {Data} from "@xeokit/data";

describe('build', function () {

    const data = new Data();

    let model;

    it('create data model', function () {
        model = data.createModel({
            id: "myModel"
        });
        expect(data.models["myModel"]).toBe(model);
    });


});