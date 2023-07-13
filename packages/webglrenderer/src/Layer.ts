import {createVec4, identityMat4, transformPoint4} from "@xeokit/matrix";
import type {View} from "@xeokit/viewer";
import type {FloatArrayParam} from "@xeokit/math";

import type {WebGLRendererModel} from "./WebGLRendererModel";
import {DataTextureSet} from "./DataTextureSet";
import {MeshCounts} from "./MeshCounts";
import {SCENE_OBJECT_FLAGS} from './SCENE_OBJECT_FLAGS';
import {RENDER_PASSES} from './RENDER_PASSES';
import {LinesPrimitive, PointsPrimitive} from "@xeokit/constants";
import {AABB3ToOBB3, collapseAABB3, expandAABB3Point3} from "@xeokit/boundaries";
import type {GeometryBucketParams, GeometryCompressedParams, MeshParams} from "@xeokit/scene";
import type {WebGLRendererTextureSet} from "./WebGLRendererTextureSet";
import {
    createEachEdgeOffsetDataTexture,
    createEachMeshAttributesDataTexture,
    createEachMeshMatricesDataTexture,
    createEdgeIndices16BitDataTexture,
    createEdgeIndices32BitDataTexture,
    createEdgeIndices8BitDataTexture,
    createIndices16BitDataTexture,
    createIndices32BitDataTexture,
    createIndices8BitDataTexture,
    createPositionsDataTexture
} from "./dataTextures";
import type {LayerParams} from "./LayerParams";
import type {GeometryBucketHandle} from "./GeometryBucketHandle";
import {DataTextureBuffer} from "./DataTextureBuffer";

const MAX_MESH_PARTS = (1 << 12); // 12 bits 
const MAX_DATATEXTURE_HEIGHT = (1 << 11); // 2048
const INDICES_EDGE_INDICES_ALIGNMENT_SIZE = 8;

const identityMatrix = identityMat4();
const tempVec4a = createVec4([0, 0, 0, 1]);
const tempVec4b = createVec4([0, 0, 0, 1]);
const tempVec4c = createVec4([0, 0, 0, 1]);
const tempUint8Array4 = new Uint8Array(4);
const tempFloat32Array3 = new Float32Array(3);


interface GeometryHandle { // Storage handle for a geometry within a Layer
    aabb: FloatArrayParam;
    positionsDecompressMatrix: FloatArrayParam;
    geometryBucketHandles: GeometryBucketHandle[]
}

interface MeshPartParams {
    aabb: FloatArrayParam;
}

interface MeshPartHandle {
    vertsBase: number;
    numVerts: number;
}

/**
 * @private
 */
export interface LayerRenderState { // What a LayerRenderer needs to render this Layer
    materialTextureSet: WebGLRendererTextureSet; // Color, opacity, metal/roughness, ambient occlusion maps
    dataTextureSet: DataTextureSet;  // Data textures containing geometry, transforms, flags and material attributes
    primitive: number; // Layer primitive type
    numIndices8Bits: number; // How many 8-bit encodable indices in layer
    numIndices16Bits: number; // How many 16-bit encodable indices in layer
    numIndices32Bits: number; // How many 32-bit encodable indices in layer
    numEdgeIndices8Bits: number; // How many 8-bit encodable edge indices in layer
    numEdgeIndices16Bits: number; // How many 16-bit encodable edge indices in layer
    numEdgeIndices32Bits: number; // How many 32-bit encodable edge indices in layer
    numVertices: number; // How many vertices in layer
}

/**
 * @private
 */
export class Layer {

    rendererModel: WebGLRendererModel;
    layerIndex: number;
    meshCounts: MeshCounts;
    renderState: LayerRenderState;

    #gl: WebGL2RenderingContext;
    #view: View;
    #dataTextureBuffer: DataTextureBuffer;
    #geometryHandles: { [key: string]: any };
    #meshPartHandles: MeshPartHandle[];
    #numMeshParts: number;
    #deferredSetFlagsActive: boolean;
    #deferredSetFlagsDirty: boolean;
    #built: boolean;

    constructor(layerParams: LayerParams, renderers?: any) {

        this.meshCounts = new MeshCounts();
        this.layerIndex = layerParams.layerIndex;
        this.rendererModel = layerParams.rendererModel;

        this.renderState = <LayerRenderState>{
            primitive: layerParams.primitive,
            dataTextureSet: new DataTextureSet(),
            numIndices8Bits: 0,
            numIndices16Bits: 0,
            numIndices32Bits: 0,
            numEdgeIndices8Bits: 0,
            numEdgeIndices16Bits: 0,
            numEdgeIndices32Bits: 0,
            numVertices: 0
        };

        this.#gl = layerParams.gl;
        this.#view = layerParams.view;
        this.#dataTextureBuffer = new DataTextureBuffer();
        this.#numMeshParts = 0;
        this.#geometryHandles = {};
        this.#meshPartHandles = [];
        this.#built = false;

        this.beginDeferredFlags();
    }

    get hash() {
        return `layer-${this.renderState.primitive}`;
    }

    canCreateMesh(geometryCompressedParams: GeometryCompressedParams): boolean {
        if (this.#built) {
            throw "Already built";
        }
        const renderState = this.renderState;
        const numGeometryBuckets = geometryCompressedParams.geometryBuckets.length;
        if ((this.#numMeshParts + numGeometryBuckets) > MAX_MESH_PARTS) {
            return false;
        }
        let numPositions = 0;
        let numIndices = 0;
        for (let i = 0; i < numGeometryBuckets; i++) {
            const geometryBucket = geometryCompressedParams.geometryBuckets[i];
            numPositions += geometryBucket.positionsCompressed.length;
            if (geometryBucket.indices) {
                numIndices += geometryBucket.indices.length;
            }
        }
        const primVerts = (geometryCompressedParams.primitive === PointsPrimitive) ? 1 : (geometryCompressedParams.primitive == LinesPrimitive ? 2 : 3);
        const maxIndicesOfAnyBits = Math.max(renderState.numIndices8Bits, renderState.numIndices16Bits, renderState.numIndices32Bits);
        const numVerts = numPositions / primVerts;
        let numTriangleIndices = numIndices / 3;
        return (renderState.numVertices + numVerts) <= MAX_DATATEXTURE_HEIGHT * 1024 && (numTriangleIndices + numIndices) <= MAX_DATATEXTURE_HEIGHT * 1024;
    }

    hasGeometry(geometryId: string): boolean {
        return this.#geometryHandles[geometryId];
    }

    createGeometryCompressed(geometryCompressedParams: GeometryCompressedParams) {
        if (this.#built) {
            throw "Already built";
        }
        const geometryBucketHandles = [];
        for (let i = 0, len = geometryCompressedParams.geometryBuckets.length; i < len; i++) {
            geometryBucketHandles.push(this.#createGeometryBucket(geometryCompressedParams.geometryBuckets[i]));
        }
        this.#geometryHandles[geometryCompressedParams.id] = <GeometryHandle>{
            id: geometryCompressedParams.id,
            aabb: geometryCompressedParams.aabb,
            positionsDecompressMatrix: geometryCompressedParams.positionsDecompressMatrix,
            geometryBucketHandles
        };
    }

    #createGeometryBucket(geometryBucket: GeometryBucketParams): GeometryBucketHandle {
        const renderState = this.renderState;
        if (geometryBucket.indices) {  // Align indices to INDICES_EDGE_INDICES_ALIGNMENT_SIZE
            const numVertsForPrim = (this.renderState.primitive === PointsPrimitive ? 1 : (this.renderState.primitive === LinesPrimitive ? 2 : 3));
            const alignedIndicesLen = Math.ceil((geometryBucket.indices.length / numVertsForPrim) / INDICES_EDGE_INDICES_ALIGNMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNMENT_SIZE * numVertsForPrim;
            const alignedIndices = new Uint32Array(alignedIndicesLen);
            alignedIndices.fill(0);
            alignedIndices.set(geometryBucket.indices);
            geometryBucket.indices = alignedIndices;
        }
        if (geometryBucket.edgeIndices) {  // Align edge indices to INDICES_EDGE_INDICES_ALIGNMENT_SIZE
            const alignedEdgeIndicesLen = Math.ceil((geometryBucket.edgeIndices.length / 2) / INDICES_EDGE_INDICES_ALIGNMENT_SIZE) * INDICES_EDGE_INDICES_ALIGNMENT_SIZE * 2;
            const alignedEdgeIndices = new Uint32Array(alignedEdgeIndicesLen);
            alignedEdgeIndices.fill(0);
            alignedEdgeIndices.set(geometryBucket.edgeIndices);
            geometryBucket.edgeIndices = alignedEdgeIndices;
        }
        const dataTextureBuffer = this.#dataTextureBuffer;
        const positionsCompressed = geometryBucket.positionsCompressed;
        const indices = geometryBucket.indices;
        const edgeIndices = geometryBucket.edgeIndices;
        const vertexBase = dataTextureBuffer.positionsCompressed.length / 3;
        const numVertices = positionsCompressed.length / 3;
        for (let i = 0, len = positionsCompressed.length; i < len; i++) {
            dataTextureBuffer.positionsCompressed.push(positionsCompressed[i]);
        }
        let indicesBase;
        let numTriangles = 0;
        if (indices) {
            numTriangles = indices.length / 3;
            let indicesBuffer;
            if (numVertices <= (1 << 8)) {
                indicesBuffer = dataTextureBuffer.indices_8Bits;
            } else if (numVertices <= (1 << 16)) {
                indicesBuffer = dataTextureBuffer.indices_16Bits;
            } else {
                indicesBuffer = dataTextureBuffer.indices_32Bits;
            }
            indicesBase = indicesBuffer.length / 3;
            for (let i = 0, len = indices.length; i < len; i++) {
                indicesBuffer.push(indices[i]);
            }
        }
        let edgeIndicesBase;
        let numEdges = 0;
        if (edgeIndices) {
            numEdges = edgeIndices.length / 2;
            let edgeIndicesBuffer;
            if (numVertices <= (1 << 8)) {
                edgeIndicesBuffer = dataTextureBuffer.edgeIndices_8Bits;
            } else if (numVertices <= (1 << 16)) {
                edgeIndicesBuffer = dataTextureBuffer.edgeIndices_16Bits;
            } else {
                edgeIndicesBuffer = dataTextureBuffer.edgeIndices_32Bits;
            }
            edgeIndicesBase = edgeIndicesBuffer.length / 2;
            for (let i = 0, len = edgeIndices.length; i < len; i++) {
                edgeIndicesBuffer.push(edgeIndices[i]);
            }
        }
        renderState.numVertices += numVertices;
        return <GeometryBucketHandle>{
            vertexBase,
            numVertices,
            numTriangles,
            numEdges,
            indicesBase,
            edgeIndicesBase
        };
    }

    createMesh(meshParams: MeshParams): number {
        if (this.#built) {
            throw new Error("Already built");
        }
        const meshIndex = this.meshCounts.numMeshes;
        const meshPartIds: number[] = [];
        if (!meshParams.geometryId) {
            throw new Error("geometryId expected");
        }
        const geometryHandle = this.#geometryHandles[meshParams.geometryId];
        if (!geometryHandle) {
            throw new Error("Geometry not found");
        }
        geometryHandle.geometryBucketHandles.forEach((geometryBucketHandle: GeometryBucketHandle) => {
            const meshPartId = this.#createMeshPart(meshParams, geometryHandle, geometryBucketHandle);
            meshPartIds.push(meshPartId);
        });
        const worldAABB = collapseAABB3();
        const geometryOBB = AABB3ToOBB3(geometryHandle.aabb);
        for (let i = 0, len = geometryOBB.length; i < len; i += 4) {
            tempVec4a[0] = geometryOBB[i + 0];
            tempVec4a[1] = geometryOBB[i + 1];
            tempVec4a[2] = geometryOBB[i + 2];
            if (meshParams.matrix) {
                transformPoint4(meshParams.matrix, tempVec4a, tempVec4b);
                // transformPoint4(meshParams.matrix, tempVec4b, tempVec4c);
                expandAABB3Point3(worldAABB, tempVec4b);
            } else {
                expandAABB3Point3(worldAABB, tempVec4b);
            }
        }
        this.meshCounts.numMeshes++;
        return meshIndex;
    }

    #createMeshPart(meshParams: MeshParams, geometryHandle: GeometryHandle, geometryBucketHandle: GeometryBucketHandle): number {

        const dataTextureBuffer = this.#dataTextureBuffer;

        const renderState = this.renderState;

        const matrix = meshParams.matrix || identityMatrix;
        const color = meshParams.color || [255, 255, 255];
        const opacity = meshParams.opacity;
        const metallic = meshParams.metallic;
        const roughness = meshParams.roughness;

        const positionsIndex = dataTextureBuffer.positionsCompressed.length;
        const vertsIndex = positionsIndex / 3;

        dataTextureBuffer.eachMeshPositionsDecompressMatrix.push(geometryHandle.positionsDecompressMatrix);
        dataTextureBuffer.eachMeshMatrices.push(matrix);
        dataTextureBuffer.eachMeshColor.push([color[0], color[1], color[2], 255]);
        dataTextureBuffer.eachMeshPickColor.push(meshParams.pickColor);

        let currentNumIndices;
        if (geometryBucketHandle.numVertices <= (1 << 8)) {
            currentNumIndices = renderState.numIndices8Bits;
        } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
            currentNumIndices = renderState.numIndices16Bits;
        } else {
            currentNumIndices = renderState.numIndices32Bits;
        }
        dataTextureBuffer.eachMeshVertexPortionBase.push(geometryBucketHandle.vertexBase);
        dataTextureBuffer.eachMeshVertexPortionOffset.push(currentNumIndices / 3 - geometryBucketHandle.indicesBase);

        // Edge indices

        let currentNumEdgeIndices;
        if (geometryBucketHandle.numVertices <= (1 << 8)) {
            currentNumEdgeIndices = renderState.numEdgeIndices8Bits;
        } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
            currentNumEdgeIndices = renderState.numEdgeIndices16Bits;
        } else {
            currentNumEdgeIndices = renderState.numEdgeIndices32Bits;
        }
        dataTextureBuffer.eachMeshEdgeIndicesOffset.push(currentNumEdgeIndices / 2 - geometryBucketHandle.edgeIndicesBase);

        // Primitive -> mesh lookup

        const meshPartId = this.#meshPartHandles.length;

        if (geometryBucketHandle.numTriangles > 0) {
            const numIndices = geometryBucketHandle.numTriangles * 3;
            let eachPrimitiveMeshBuffer;
            if (geometryBucketHandle.numVertices <= (1 << 8)) {
                eachPrimitiveMeshBuffer = dataTextureBuffer.eachPrimitiveMesh_8Bits;
                renderState.numIndices8Bits += numIndices;
            } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
                eachPrimitiveMeshBuffer = dataTextureBuffer.eachPrimitiveMesh_16Bits;
                renderState.numIndices16Bits += numIndices;
            } else {
                eachPrimitiveMeshBuffer = dataTextureBuffer.eachPrimitiveMesh_32Bits;
                renderState.numIndices32Bits += numIndices;
            }
            for (let i = 0; i < geometryBucketHandle.numTriangles; i += INDICES_EDGE_INDICES_ALIGNMENT_SIZE) {
                eachPrimitiveMeshBuffer.push(meshPartId);
            }
        }

        // Edge index -> mesh lookup

        if (geometryBucketHandle.numEdges > 0) {
            let numEdgeIndices = geometryBucketHandle.numEdges * 2;
            let edgeIndicesMeshIdBuffer;
            if (geometryBucketHandle.numVertices <= (1 << 8)) {
                edgeIndicesMeshIdBuffer = dataTextureBuffer.eachEdgeMesh_8Bits;
                renderState.numEdgeIndices8Bits += numEdgeIndices;
            } else if (geometryBucketHandle.numVertices <= (1 << 16)) {
                edgeIndicesMeshIdBuffer = dataTextureBuffer.eachEdgeMesh_16Bits;
                renderState.numEdgeIndices16Bits += numEdgeIndices;
            } else {
                edgeIndicesMeshIdBuffer = dataTextureBuffer.eachEdgeMesh_32Bits;
                renderState.numEdgeIndices32Bits += numEdgeIndices;
            }
            for (let i = 0; i < geometryBucketHandle.numEdges; i += INDICES_EDGE_INDICES_ALIGNMENT_SIZE) {
                edgeIndicesMeshIdBuffer.push(meshPartId);
            }
        }
        dataTextureBuffer.eachEdgeOffset.push([0, 0, 0]);

        this.#meshPartHandles.push(<MeshPartHandle>{
            vertsBase: vertsIndex,
            numVerts: geometryBucketHandle.numTriangles //////////////////// TODO
        });
        this.#numMeshParts++;
        return meshPartId;
    }

    build() {
        if (this.#built) {
            throw new Error("Already built");
        }
        const gl = this.#gl;
        const dataTextureBuffer = this.#dataTextureBuffer;
        const dataTextureSet = this.renderState.dataTextureSet;
        dataTextureSet.positions = createPositionsDataTexture(gl, dataTextureBuffer.positionsCompressed);
        dataTextureSet.indices_8Bits = createIndices8BitDataTexture(gl, dataTextureBuffer.indices_8Bits);
        dataTextureSet.indices_16Bits = createIndices16BitDataTexture(gl, dataTextureBuffer.indices_16Bits);
        dataTextureSet.indices_32Bits = createIndices32BitDataTexture(gl, dataTextureBuffer.indices_32Bits);
        dataTextureSet.edgeIndices_8Bits = createEdgeIndices8BitDataTexture(gl, dataTextureBuffer.edgeIndices_8Bits);
        dataTextureSet.edgeIndices_16Bits = createEdgeIndices16BitDataTexture(gl, dataTextureBuffer.edgeIndices_16Bits);
        dataTextureSet.edgeIndices_32Bits = createEdgeIndices32BitDataTexture(gl, dataTextureBuffer.edgeIndices_32Bits);
        dataTextureSet.eachMeshAttributes = createEachMeshAttributesDataTexture(gl,
            dataTextureBuffer.eachMeshColor,
            dataTextureBuffer.eachMeshPickColor,
            dataTextureBuffer.eachMeshVertexPortionBase,
            dataTextureBuffer.eachMeshVertexPortionOffset,
            dataTextureBuffer.eachMeshEdgeIndicesOffset);
        dataTextureSet.eachMeshMatrices = createEachMeshMatricesDataTexture(gl, dataTextureBuffer.eachMeshPositionsDecompressMatrix, dataTextureBuffer.eachMeshMatrices);
        // dataTextureSet.eachPrimitiveMesh8BitsDataTexture = createPointerTableDataTexture(gl, dataTextureBuffer.eachPrimitiveMesh_8Bits);
        // dataTextureSet.eachPrimitiveMesh16BitsDataTexture = createPointerTableDataTexture(gl, dataTextureBuffer.eachPrimitiveMesh_16Bits);
        // dataTextureSet.eachPrimitiveMesh32BitsDataTexture = createPointerTableDataTexture(gl, dataTextureBuffer.eachPrimitiveMesh_32Bits);
        // dataTextureSet.eachEdgeMesh8BitsDataTexture = createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh_8Bits);
        // dataTextureSet.eachEdgeMesh16BitsDataTexture = createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh_16Bits);
        // dataTextureSet.eachEdgeMesh32BitsDataTexture = createPointerTableDataTexture(gl, dataTextureBuffer.eachEdgeMesh_32Bits);
        dataTextureSet.eachEdgeOffset = createEachEdgeOffsetDataTexture(gl, dataTextureBuffer.eachEdgeOffset);
        dataTextureSet.build();
        // @ts-ignore
        this.#dataTextureBuffer = null;
        this.#geometryHandles = {};
        this.#meshPartHandles = [];
        this.#built = true;
    }

    isEmpty() {
        return this.meshCounts.numMeshes == 0;
    }

    initFlags(meshIndex: number, flags: number, meshTransparent: boolean) {
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            this.meshCounts.numVisible++;
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.meshCounts.numHighlighted++;
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.meshCounts.numXRayed++;
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.meshCounts.numSelected++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.meshCounts.numClippable++;
        }
        if (flags & SCENE_OBJECT_FLAGS.EDGES) {
            this.meshCounts.numEdges++;
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts.numPickable++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts.numCulled++;
        }
        if (meshTransparent) {
            this.meshCounts.numTransparent++;
        }
        this.#setMeshFlags(meshIndex, flags, meshTransparent);
        this.#setMeshFlags2(meshIndex, flags);
    }

    beginDeferredFlags() {
        this.#deferredSetFlagsActive = true;
    }

    commitDeferredFlags() {
        this.#deferredSetFlagsActive = false;
        if (!this.#deferredSetFlagsDirty) {
            return;
        }
        this.#deferredSetFlagsDirty = false;
        const gl = this.#gl;
        const dataTextureSet = this.renderState.dataTextureSet;
        // @ts-ignore
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshAttributes.texture);
        // @ts-ignore
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, dataTextureSet.eachMeshAttributes.textureWidth, dataTextureSet.eachMeshAttributes.textureHeight, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, dataTextureSet.eachMeshAttributes.textureData);
        // @ts-ignore
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachEdgeOffset.texture);
        // @ts-ignore
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, dataTextureSet.eachEdgeOffset.textureWidth, dataTextureSet.eachEdgeOffset.textureHeight, gl.RGB, gl.FLOAT, dataTextureSet.eachEdgeOffset.textureData);
    }

    flushInitFlags() {
        this.commitDeferredFlags();
    }

    setMeshVisible(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            debugger;
            this.meshCounts.numVisible++;
        } else {
            this.meshCounts.numVisible--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setMeshHighlighted(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.meshCounts.numHighlighted++;
        } else {
            this.meshCounts.numHighlighted--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setMeshXRayed(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.meshCounts.numXRayed++;
        } else {
            this.meshCounts.numXRayed--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setMeshSelected(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.meshCounts.numSelected++;
        } else {
            this.meshCounts.numSelected--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setMeshEdges(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        if (flags & SCENE_OBJECT_FLAGS.EDGES) {
            this.meshCounts.numEdges++;
        } else {
            this.meshCounts.numEdges--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setMeshClippable(meshIndex: number, flags: number) {
        if (!this.#built) {
            throw "Not built";
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.meshCounts.numClippable++;
        } else {
            this.meshCounts.numClippable--;
        }
        this.#setMeshFlags2(meshIndex, flags);
    }

    setMeshCulled(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts.numCulled++;
        } else {
            this.meshCounts.numCulled--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setMeshCollidable(meshIndex: number, flags: number) {
        if (!this.#built) {
            throw "Not built";
        }
    }

    setMeshPickable(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts.numPickable++;
        } else {
            this.meshCounts.numPickable--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    setMeshColor(meshIndex: number, color: FloatArrayParam, transparent?: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        const dataTextureSet = this.renderState.dataTextureSet;
        const gl = this.#gl;
        tempUint8Array4 [0] = color[0];
        tempUint8Array4 [1] = color[1];
        tempUint8Array4 [2] = color[2];
        tempUint8Array4 [3] = color[3];
        // @ts-ignore
        dataTextureSet.eachMeshAttributes.textureData.set(tempUint8Array4, meshIndex * 28);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        // @ts-ignore
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshAttributes.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, meshIndex, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, tempUint8Array4);
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setMeshTransparent(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        if (transparent) {
            this.meshCounts.numTransparent++;
            this.meshCounts.numTransparent++;
        } else {
            this.meshCounts.numTransparent--;
            this.meshCounts.numTransparent--;
        }
        this.#setMeshFlags(meshIndex, flags, transparent);
    }

    #setMeshFlags(meshIndex: number, flags: number, transparent: boolean) {
        if (!this.#built) {
            throw "Not built";
        }
        const visible = !!(flags & SCENE_OBJECT_FLAGS.VISIBLE);
        const xrayed = !!(flags & SCENE_OBJECT_FLAGS.XRAYED);
        const highlighted = !!(flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED);
        const selected = !!(flags & SCENE_OBJECT_FLAGS.SELECTED);
        const edges = !!(flags & SCENE_OBJECT_FLAGS.EDGES);
        const pickable = !!(flags & SCENE_OBJECT_FLAGS.PICKABLE);
        const culled = !!(flags & SCENE_OBJECT_FLAGS.CULLED);
        let f0; // Color
        if ((!visible) || culled || xrayed) { // Highlight & select are layered on top of color - not mutually exclusive
            f0 = RENDER_PASSES.NOT_RENDERED;
        } else {
            if (transparent) {
                f0 = RENDER_PASSES.COLOR_TRANSPARENT;
            } else {
                f0 = RENDER_PASSES.COLOR_OPAQUE;
            }
        }
        let f1; // Silhouette
        if ((!visible) || culled) {
            f1 = RENDER_PASSES.NOT_RENDERED;
        } else if (selected) {
            f1 = RENDER_PASSES.SILHOUETTE_SELECTED;
        } else if (highlighted) {
            f1 = RENDER_PASSES.SILHOUETTE_HIGHLIGHTED;
        } else if (xrayed) {
            f1 = RENDER_PASSES.SILHOUETTE_XRAYED;
        } else {
            f1 = RENDER_PASSES.NOT_RENDERED;
        }
        let f2 = 0; // Edges
        if ((!visible) || culled) {
            f2 = RENDER_PASSES.NOT_RENDERED;
        } else if (selected) {
            f2 = RENDER_PASSES.EDGES_SELECTED;
        } else if (highlighted) {
            f2 = RENDER_PASSES.EDGES_HIGHLIGHTED;
        } else if (xrayed) {
            f2 = RENDER_PASSES.EDGES_XRAYED;
        } else if (edges) {
            if (transparent) {
                f2 = RENDER_PASSES.EDGES_COLOR_TRANSPARENT;
            } else {
                f2 = RENDER_PASSES.EDGES_COLOR_OPAQUE;
            }
        } else {
            f2 = RENDER_PASSES.NOT_RENDERED;
        }
        let f3 = (visible && !culled && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED; // Pick
        const dataTextureSet = this.renderState.dataTextureSet;
        const gl = this.#gl;
        tempUint8Array4 [0] = f0;
        tempUint8Array4 [1] = f1;
        tempUint8Array4 [2] = f2;
        tempUint8Array4 [3] = f3;
        if (this.#deferredSetFlagsActive) {
            // @ts-ignore
            dataTextureSet.eachMeshAttributes.textureData.set(tempUint8Array4, meshIndex * 28 + 8);
            this.#deferredSetFlagsDirty = true;
            return;
        }
        // @ts-ignore
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshAttributes.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 2, meshIndex, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, tempUint8Array4);
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    #setMeshFlags2(meshIndex: number, flags: number) {
        if (!this.#built) {
            throw "Not built";
        }
        const clippable = !!(flags & SCENE_OBJECT_FLAGS.CLIPPABLE) ? 255 : 0;
        const dataTextureSet = this.renderState.dataTextureSet;
        const gl = this.#gl;
        tempUint8Array4 [0] = clippable;
        tempUint8Array4 [1] = 0;
        tempUint8Array4 [2] = 1;
        tempUint8Array4 [3] = 2;
        if (this.#deferredSetFlagsActive) {
            // @ts-ignore
            dataTextureSet.eachMeshAttributes.textureData.set(tempUint8Array4, meshIndex * 28 + 12); // Flags
            this.#deferredSetFlagsDirty = true;
            return;
        }
        // @ts-ignore
        gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshAttributes.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 3, meshIndex, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, tempUint8Array4);
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setMeshOffset(meshIndex: number, offset: FloatArrayParam) {
        if (!this.#built) {
            throw "Not built";
        }
        const dataTextureSet = this.renderState.dataTextureSet;
        const gl = this.#gl;
        tempFloat32Array3 [0] = offset[0];
        tempFloat32Array3 [1] = offset[1];
        tempFloat32Array3 [2] = offset[2];
        // dataTextureSet.eachMeshOffset.textureData.set(tempFloat32Array3, meshIndex * 3);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        //gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshOffset.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, meshIndex, 1, 1, gl.RGB, gl.FLOAT, tempFloat32Array3);
        // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    setMeshMatrix(meshIndex: number, matrix: FloatArrayParam) {
        if (!this.#built) {
            throw "Not built";
        }
        const dataTextureSet = this.renderState.dataTextureSet;
        const gl = this.#gl;

        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }

    }

    setMeshViewMatrixIndex(meshIndex: number, index: number) {
        if (!this.#built) {
            throw "Not built";
        }
        const dataTextureSet = this.renderState.dataTextureSet;
        const gl = this.#gl;
        // tempUint8Array4 [0] = color[0];
        // tempUint8Array4 [1] = color[1];
        // tempUint8Array4 [2] = color[2];
        // tempUint8Array4 [3] = color[3];
        // // @ts-ignore
        // dataTextureSet.eachMeshAttributes.textureData.set(tempUint8Array4, meshIndex * 28);
        if (this.#deferredSetFlagsActive) {
            this.#deferredSetFlagsDirty = true;
            return;
        }
        // // @ts-ignore
        // gl.bindTexture(gl.TEXTURE_2D, dataTextureSet.eachMeshAttributes.texture);
        // gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, meshIndex, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, tempUint8Array4);
        // // gl.bindTexture (gl.TEXTURE_2D, null);
    }

    destroy() {
        this.renderState.dataTextureSet.destroy();
    }
}

