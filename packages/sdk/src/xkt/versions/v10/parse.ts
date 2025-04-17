import {inflateXKT} from "./inflateXKT";
import {unpackXKT} from "./unpackXKT";
import {SceneModel} from "../../../scene";
import {xktToModel} from "./xktToModel";

export function parse(params: {
    fileData: any;
    sceneModel?: SceneModel;
}, options: any = {}): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        const {fileData, sceneModel} = params;
        if (sceneModel) {
            xktToModel({
                xktData: inflateXKT(unpackXKT(fileData)),
                sceneModel
            });
        }
        return resolve();
    });
}
