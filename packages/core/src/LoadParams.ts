import type {SceneModel} from "@xeokit/core/components";
import type {DataModel} from "@xeokit/datamodel";

/**
 * Generic parameters for various loader functions (eg. {@link @xeokit/xkt!loadXKT | loadXKT}, {@link @xeokit/las!loadLAS | loadLAS}, {@link @xeokit/gltf!loadGLTF | loadGLTF}...).
 */
export interface LoadParams {

    /**
     * File data to load.
     */
    data: ArrayBuffer,

    /**
     * Target to load the file's model representation into.
     */
    sceneModel: SceneModel,

    /**
     * Target to the load the file's semantic data into, if available.
     */
    dataModel?: DataModel,

    /**
     * Optional logging callback.
     */
    log?: Function
}