import type {Geometry} from "./Geometry";
import type {Texture} from "./Texture";
import type {TextureSet} from "./TextureSet";
import type {Mesh} from "./Mesh";
import type {XKTObject} from "./XKTObject";

/**
 *
 */
export interface ReadableModel {

    /**
     * The geometries in this model.
     */
    geometries: { [key: string]: Geometry };

    /**
     * The textures in this model.
     */
    textures: { [key: string]: Texture };

    /**
     * Texture sets in this model.
     */
    textureSets: { [key: string]: TextureSet };

    /**
     * Meshes in this model
     */
    meshes: { [key: string]: Mesh };

    /**
     *
     */
    objects: { [key: string]: XKTObject };
}