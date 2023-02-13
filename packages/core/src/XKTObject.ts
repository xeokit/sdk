import type {Mesh} from "./Mesh";

/**
 * Represents an object.
 *
 * * Stored in {@link @xeokit/core/components!Model.objects | Model.objects} and {@link @xeokit/core/components!Scene.objects | Scene.objects}
 * * Created with {@link @xeokit/core/components!Model.createObject | Model.createObject}
 */
export interface XKTObject {

    /**
     * Unique ID of this object.
     */
    readonly id: string;

    /**
     * The {@link Mesh | Meshes} belonging to this object.
     */
    readonly meshes: Mesh[];
}
