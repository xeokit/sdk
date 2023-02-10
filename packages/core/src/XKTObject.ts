import type {Mesh} from "./Mesh";

/**
 * Represents an object.
 *
 * * Stored in {@link @xeokit/core/components!Model.objects}
 * * Created with {@link @xeokit/core/components!BuildableModel.createObject}
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
