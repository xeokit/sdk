import {Data} from "@xeokit/data";
import {Scene} from "@xeokit/scene";
import * as testUtils from "./testUtils";
import {TrianglesPrimitive} from "@xeokit/core/src/constants";

describe('build', function () {

    const data = new Data();
    let dataModel = data.createModel(testUtils.sampleDataModelJSON);
    dataModel.build();

    const scene = new Scene();
    let sceneModel;
    let geometry;

    it('create scene model', () => {
        sceneModel = scene.createModel({id: "myModel"});
        expect(scene.models["myModel"]).toBe(sceneModel);
    });

    it('create geometry from uncompressed params', () => {
        geometry = sceneModel.createGeometry({
            id: "myBoxGeometry",
            primitive: TrianglesPrimitive,
            positions: [ // Floats
                1, 1, 1, -1, 1, 1,
                -1, -1, 1, 1, -1, 1, 1,
                -1, -1, 1, 1, -1, -1, 1, -1, -1,
                -1, -1
            ],
            indices: [
                0, 1, 2, 0, 2, 3, 4, 5, 6, 4,
                6, 7, 8, 9, 10, 8, 10, 11, 12,
                13, 14, 12, 14, 15, 16, 17, 18,
                16, 18, 19, 20, 21, 22, 20, 22, 23
            ]
        });
        expect(geometry.buckets).toBe(sceneModel);
    });
});