import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {loadWebIFC} from "../src";
import {SDKError} from "@xeokit/core";
import * as WebIFC from "web-ifc";
import * as fs from "fs";
import {roundSceneModelParams} from "@xeokit/testutils";
import {IfcOpenHouse4_WebIFC_DataModel_JSON} from "./assets/IfcOpenHouse4_WebIFC_DataModel_JSON";
import {IfcOpenHouse4_WebIFC_SceneModel_JSON} from "./assets/IfcOpenHouse4_WebIFC_SceneModel_JSON";

describe('saveAndLoadWebIFC', () => {

    const data = new Data();
    const scene = new Scene();

    let dataModel;
    let sceneModel;

    it("loadWebIFC loads the arrayBuffer into a DataModel and SceneModel", async () => {

        sceneModel = scene.createModel({id: "myModel"});

        if (sceneModel instanceof SDKError) {
            throw sceneModel;
        }

        dataModel = data.createModel({id: "myModel"});

        if (dataModel instanceof SDKError) {
            throw sceneModel;
        }

        const ifcAPI = new WebIFC.IfcAPI();

        expect(ifcAPI).toBeDefined();

        const fileData = fs.readFileSync("./tests/assets/IfcOpenHouse4.ifc");

        expect(fileData).toBeInstanceOf(Buffer);
        expect(fileData.length).toBe(113264);

        //   ifcAPI.SetWasmPath(cfg.wasmPath);

        await ifcAPI.Init();

        await loadWebIFC({
            ifcAPI,
            fileData,
            sceneModel,
            dataModel
        });

        await sceneModel.build();

        dataModel.build();

        expect(dataModel.getJSON()).toEqual(IfcOpenHouse4_WebIFC_DataModel_JSON);

        expect(roundSceneModelParams(sceneModel.getJSON())).toEqual(roundSceneModelParams(IfcOpenHouse4_WebIFC_SceneModel_JSON));
    });

});