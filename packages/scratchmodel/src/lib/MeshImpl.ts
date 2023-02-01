import {FloatArrayParam} from "@xeokit/math/math";
import {createVec3} from "@xeokit/math/matrix";
import {Geometry, Mesh, TextureSet} from "@xeokit/core/components";

/**
 * @private
 */
export class MeshImpl implements Mesh {

    id: string;
    geometry: Geometry;
    textureSet?: TextureSet;
    color: FloatArrayParam;
    matrix: FloatArrayParam;
    metallic: number;
    roughness: number;
    opacity: number;

    constructor(meshParams: {
        id: string;
        geometry: Geometry;
        textureSet: TextureSet;
        matrix: FloatArrayParam;
        color: FloatArrayParam;
        opacity: number;
        roughness: number;
        metallic: number;
    }) {
        this.id = meshParams.id;
        this.matrix = meshParams.matrix;
        this.geometry = meshParams.geometry;
        this.color = meshParams.color || createVec3([1, 1, 1]);
        this.metallic = (meshParams.metallic !== null && meshParams.metallic !== undefined) ? meshParams.metallic : 0;
        this.roughness = (meshParams.roughness !== null && meshParams.roughness !== undefined) ? meshParams.roughness : 1;
        this.opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? meshParams.opacity : 1.0;
        this.textureSet = meshParams.textureSet;
    }
}
