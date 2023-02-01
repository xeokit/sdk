import type {Mesh} from "./Mesh";

/**
 * Represents an object.
 *
 * * Stored in {@link Model.objects}
 * * Created with {@link BuildableModel.createObject}
 */
export interface XKTObject  {

    /**
     * Unique ID of this object.
     */
    id: string;

    /**
     * The {@link Mesh|Meshes} contained within this object.
     */
    meshes: Mesh[];
}
