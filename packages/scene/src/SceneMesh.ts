import type {FloatArrayParam} from "@xeokit/math";
import {createMat4, createVec4, identityMat4, isIdentityMat4, transformPoint4} from "@xeokit/matrix";
import type {RendererMesh} from "./RendererMesh";
import type {SceneGeometry} from "./SceneGeometry";
import type {SceneTextureSet} from "./SceneTextureSet";
import type {SceneObject} from "./SceneObject";
import type {SceneMeshParams} from "./SceneMeshParams";
import {SceneTile} from "./SceneTile";
import {collapseAABB3, createAABB3, expandAABB3Point3} from "@xeokit/boundaries";

const tempVec4a = createVec4();
const tempVec4b = createVec4();

function getPositionsWorldAABB3(
    positions: FloatArrayParam,
    aabb: FloatArrayParam,
    matrix: FloatArrayParam,
    worldAABB: FloatArrayParam = createAABB3()): FloatArrayParam {
    collapseAABB3(worldAABB);
    const xScale = (aabb[3] - aabb[0]) / 65535;
    const xOffset = aabb[0];
    const yScale = (aabb[4] - aabb[1]) / 65535;
    const yOffset = aabb[1];
    const zScale = (aabb[5] - aabb[2]) / 65535;
    const zOffset = aabb[2];
    for (let i = 0, len = positions.length; i < len; i += 3) {
        tempVec4a[0] = positions[i + 0] * xScale + xOffset;
        tempVec4a[1] = positions[i + 1] * yScale + yOffset;
        tempVec4a[2] = positions[i + 2] * zScale + zOffset;
        tempVec4a[3] = 1.0;
        transformPoint4(matrix, tempVec4a, tempVec4b);
        expandAABB3Point3(worldAABB, tempVec4b);
    }
    return worldAABB;
}

/**
 * A mesh in a {@link @xeokit/scene!SceneModel | SceneModel}.
 *
 * * Stored in {@link @xeokit/scene!SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link @xeokit/scene!SceneModel.createMesh | SceneModel.createMesh}
 * * Referenced by {@link @xeokit/scene!SceneObject.meshes | SceneObject.meshes}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneMesh {

    /**
     * Unique ID of this SceneMesh.
     *
     * SceneMesh is stored by this ID in {@link @xeokit/scene!SceneModel.meshes}.
     */
    readonly id: string;

    /**
     * {@link @xeokit/scene!SceneTile} this SceneMesh belongs to.
     */
    readonly tile: SceneTile;

    /**
     * {@link @xeokit/scene!SceneGeometry} used by this SceneMesh.
     */
    readonly geometry: SceneGeometry;

    /**
     * {@link @xeokit/scene!SceneTextureSet} used by this SceneMesh.
     */
    readonly textureSet?: SceneTextureSet;

    /**
     *  Internal interface through which a {@link @xeokit/scene!SceneMesh} can load property updates into a renderers.
     *
     *  This is defined when the owner {@link @xeokit/scene!SceneModel | SceneModel} has been added to
     *  a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererMesh: RendererMesh | null;

    /**
     * The {@link @xeokit/scene!SceneObject} that uses this SceneMesh.
     */
    object: SceneObject | null;

    /**
     * TODO
     */
    streamLayerIndex: number;

    #color: FloatArrayParam;
    #matrix: FloatArrayParam;
    #rtcMatrix: FloatArrayParam;
    #opacity: number;

    readonly origin: FloatArrayParam;

    #aabbDirty: boolean;
    #aabb: FloatArrayParam;

    /**
     * @private
     */
    constructor(meshParams: {
        id: string;
        geometry: SceneGeometry;
        textureSet?: SceneTextureSet;
        matrix?: FloatArrayParam;
        rtcMatrix?: FloatArrayParam;
        color?: FloatArrayParam;
        opacity?: number;
        tile: SceneTile;
        streamLayerIndex?: number;
    }) {
        this.id = meshParams.id;
        this.#matrix = meshParams.matrix ? createMat4(meshParams.matrix) : identityMat4();
        this.#rtcMatrix = meshParams.rtcMatrix ? createMat4(meshParams.rtcMatrix) : identityMat4();
        this.#aabb = createAABB3();
        this.#aabbDirty = true;
        this.geometry = meshParams.geometry;
        this.textureSet = meshParams.textureSet;
        this.rendererMesh = null;
        this.color = meshParams.color || new Float32Array([1, 1, 1]);
        this.opacity = (meshParams.opacity !== undefined && meshParams.opacity !== null) ? meshParams.opacity : 1.0;
        this.tile = meshParams.tile;
        this.streamLayerIndex = meshParams.streamLayerIndex !== undefined ? meshParams.streamLayerIndex : 0;
    }

    /**
     * Gets the RGB color for this SceneMesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    get color(): FloatArrayParam {
        return this.#color;
    }

    /**
     * Sets the RGB color for this SceneMesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    set color(value: FloatArrayParam) {
        let color = this.#color;
        if (!color) {
            color = this.#color = new Float32Array(4);
            color[3] = 1;
        }
        if (value) {
            color[0] = value[0];
            color[1] = value[1];
            color[2] = value[2];
        } else {
            color[0] = 1;
            color[1] = 1;
            color[2] = 1;
        }
        if (this.rendererMesh) {
            this.rendererMesh.setColor(this.#color);
        }
    }

    /**
     * Gets this SceneMesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {FloatArrayParam}
     */
    get matrix(): FloatArrayParam {
        return this.#matrix;
    }

    /**
     * Gets this SceneMesh's RTC modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @internal
     * @type {FloatArrayParam}
     */
    get rtcMatrix(): FloatArrayParam {
        return this.#rtcMatrix;
    }

    /**
     * Updates this SceneMesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {FloatArrayParam}
     */
    set matrix(matrix: FloatArrayParam) {
        if (matrix) {
            // @ts-ignore
            this.#matrix.set(matrix);
        } else {
            identityMat4(this.#matrix);
        }
        if (this.rendererMesh) {
            this.rendererMesh.setMatrix(this.#matrix);
        }
        this.#aabbDirty = true;
        if (this.object) {
            this.object.setAABBDirty();
        }
    }

    /**
     * Gets the opacity factor for this SceneMesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    get opacity(): number {
        return this.#opacity;
    }

    /**
     * Sets the opacity factor for this SceneMesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    set opacity(opacity: number) {
        opacity = (opacity !== undefined && opacity !== null) ? opacity : 1.0;
        if (this.#opacity === opacity) {
            return;
        }
        this.#opacity = opacity;
        if (this.rendererMesh) {
            //       this.rendererMesh.setOpacity(this.#opacity);
        }
    }

    /**
     * Gets the World-space AABB of this SceneMesh.
     */
    get aabb(): FloatArrayParam {
        if (!this.#aabbDirty) {
            return this.#aabb;
        }
        getPositionsWorldAABB3(this.geometry.positionsCompressed, this.geometry.aabb, this.#matrix, this.#aabb);
        this.#aabbDirty = false;
        return this.#aabb;
    }

    /**
     * Gets this SceneMesh as JSON.
     */
    getJSON(): SceneMeshParams {
        const meshParams = <SceneMeshParams>{
            streamLayerIndex: this.streamLayerIndex || 0,
            id: this.id,
            geometryId: this.geometry.id,
            color: Array.from(this.#color),
            opacity: this.#opacity
        };
        if (!isIdentityMat4(this.#matrix)) {
            meshParams.matrix = Array.from(this.#matrix);
        }
        if (this.textureSet !== undefined) {
            meshParams.textureSetId = this.textureSet.id;
        }
        return meshParams;
    }
}

