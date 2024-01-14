import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {loadWebIFC} from "../src";
import {SDKError} from "@xeokit/core";
//import * as WebIFC from "web-ifc";

describe('saveAndLoadWebIFC', () => {

    const data = new Data();
    const scene = new Scene();

    let dataModel;
    let sceneModel;

    test("loadWebIFC loads the arrayBuffer into a second DataModel and SceneModel", async () => {

        sceneModel = scene.createModel({id: "myModel"});

        if (sceneModel instanceof SDKError) {
            throw sceneModel;
        }

        dataModel = data.createModel({id: "myModel"});

        if (dataModel instanceof SDKError) {
            throw sceneModel;
        }

        // const fileData = fs.readFileSync("./tests/assets/IfcOpenHouse4.ifc");
        //
        // const ifcAPI = new WebIFC.IfcAPI();
        //
        // //   ifcAPI.SetWasmPath(cfg.wasmPath);
        //
        // await ifcAPI.Init();
        //
        // await loadWebIFC({ifcAPI, fileData, sceneModel, dataModel});
        //
        // await sceneModel.build();
        //
        // dataModel.build();
    });

});