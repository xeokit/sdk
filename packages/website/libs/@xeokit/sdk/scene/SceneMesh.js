import { createMat4, createVec4, identityMat4, isIdentityMat4, transformPoint4 } from "../matrix";
import { collapseAABB3, createAABB3, expandAABB3Point3 } from "../boundaries";
const tempVec4a = createVec4();
const tempVec4b = createVec4();
function getPositionsWorldAABB3(positions, aabb, matrix, worldAABB = createAABB3()) {
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
 * A mesh in a {@link scene!SceneModel | SceneModel}.
 *
 * * Stored in {@link scene!SceneModel.meshes | SceneModel.meshes}
 * * Created with {@link scene!SceneModel.createMesh | SceneModel.createMesh}
 * * Referenced by {@link scene!SceneObject.meshes | SceneObject.meshes}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneMesh {
    /**
     * Unique ID of this SceneMesh.
     *
     * SceneMesh is stored by this ID in {@link scene!SceneModel.meshes}.
     */
    id;
    /**
     * {@link scene!SceneTile} this SceneMesh belongs to.
     */
    tile;
    /**
     * {@link scene!SceneGeometry | SceneGeometry} used by this SceneMesh.
     */
    geometry;
    /**
     * {@link scene!SceneTextureSet} used by this SceneMesh.
     */
    textureSet;
    /**
     *  Internal interface through which a {@link scene!SceneMesh} can load property updates into a renderers.
     *
     *  This is defined when the owner {@link scene!SceneModel | SceneModel} has been added to
     *  a {@link viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererMesh;
    /**
     * The {@link scene!SceneObject} that uses this SceneMesh.
     */
    object;
    /**
     * TODO
     */
    streamLayerIndex;
    #color;
    #matrix;
    #rtcMatrix;
    #opacity;
    origin;
    #aabbDirty;
    #aabb;
    /**
     * @private
     */
    constructor(meshParams) {
        this.id = meshParams.id;
        this.#matrix = meshParams.matrix ? createMat4(meshParams.matrix) : identityMat4();
        this.#rtcMatrix = meshParams.rtcMatrix ? createMat4(meshParams.rtcMatrix) : this.#matrix.slice();
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
    get color() {
        return this.#color;
    }
    /**
     * Sets the RGB color for this SceneMesh.
     *
     * Each element of the color is in range ````[0..1]````.
     */
    set color(value) {
        let color = this.#color;
        if (!color) {
            color = this.#color = new Float32Array(4);
            color[3] = 1;
        }
        if (value) {
            color[0] = value[0];
            color[1] = value[1];
            color[2] = value[2];
        }
        else {
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
    get matrix() {
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
    get rtcMatrix() {
        return this.#rtcMatrix;
    }
    /**
     * Updates this SceneMesh's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {FloatArrayParam}
     */
    set matrix(matrix) {
        if (matrix) {
            // @ts-ignore
            this.#matrix.set(matrix);
        }
        else {
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
    get opacity() {
        return this.#opacity;
    }
    /**
     * Sets the opacity factor for this SceneMesh.
     *
     * This is a factor in range ````[0..1]````.
     */
    set opacity(opacity) {
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
    get aabb() {
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
    getJSON() {
        const meshParams = {
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
//# sourceMappingURL=SceneMesh.js.map
