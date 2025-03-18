import { SceneModel } from "../scene";
import { DataModel } from "../data";
/**
 *
 */
export interface XKTManifest {
    xktFiles: string[];
    metaModelFiles?: string[];
}
/**
 *
 * @param params
 */
export declare function loadXKTManifest(params: {
    src?: string;
    manifest?: XKTManifest;
    sceneModel: SceneModel;
    dataModel: DataModel;
}): Promise<void>;
//# sourceMappingURL=loadXKTManifest.d.ts.map