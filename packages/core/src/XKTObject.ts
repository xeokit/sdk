import type {Mesh} from "./Mesh";

/**
 * Represents an object.
 *
 * * Stored in {@link @xeokit/core/components!Model.objects}
 * * Created with {@link @xeokit/core/components!Model.createObject}
 */
export interface XKTObject  {

    /**
     * Unique ID of this object.
     */
    id: string;

    /**
     * The {@link Mesh | Meshes} contained within this object.
     */
    meshes: Mesh[];

    /**
     * The 3D axis-aligned World-space boundary of this object.
     *
     * Only available after calling {@link Model.build | Model.build}.
     */
    get aabb(): Float64Array;
}
