import {ENTITY_FLAGS} from '../../../ENTITY_FLAGS';
import {RENDER_PASSES} from '../../../RENDER_PASSES';
import * as math from "../../../../../../viewer/math"
import {BatchingBuffer} from "../BatchingBuffer";
import {WebGL2SceneModel} from "../../../../WebGL2SceneModel";
import {ArrayBuf} from "../../../../../lib/ArrayBuf";
import {DrawFlags} from "../../../DrawFlags";
import {FrameContext} from "../../../../../lib/FrameContext";
import {getPointsBatchingRenderers} from "./PointsBatchingRenderers";

const tempVec3a = math.vec4();
const tempVec3b = math.vec4();
const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);
const tempVec4c = math.vec4([0, 0, 0, 1]);
const tempOBB3 = math.boundaries.OBB3();

/**
 * @private
 */
export class PointsBatchingLayer {
    layerIndex: number;
    sceneModel: WebGL2SceneModel;
    state: { [key: string]: any; };
    aabb: math.FloatArrayType;
    #batchingRenderers: any;
    #buffer: BatchingBuffer;
    #scratchMemory: any;
    #numPortions: number;
    #numVisibleLayerPortions: number;
    #numTransparentLayerPortions: number;
    #numXRayedLayerPortions: number;
    #numSelectedLayerPortions: number;
    #numHighlightedLayerPortions: number;
    #numClippableLayerPortions: number;
    #numPickableLayerPortions: number;
    #numCulledLayerPortions: number;
    #modelAABB: math.FloatArrayType;
    #portions: number[];
    #finalized: boolean;
    #preCompressedPositionsExpected: boolean;
    private sortId: string;
    #pointsBatchingRenderers: any;

    constructor(params: {
        layerIndex: number;
        sceneModel: WebGL2SceneModel;
        maxGeometryBatchSize: number;
        scratchMemory: any;
        positionsDecompressMatrix: math.FloatArrayType;
        origin:  math.FloatArrayType;
    }) {

        this.sceneModel = params.sceneModel;
        this.sortId = "PointsBatchingLayer";
        this.layerIndex = params.layerIndex;
        this.#buffer = new BatchingBuffer(params.maxGeometryBatchSize);
        this.#scratchMemory = params.scratchMemory;
        this.#pointsBatchingRenderers = getPointsBatchingRenderers(params.sceneModel.view);

        this.state = {
            positionsBuf: null,
            offsetsBuf: null,
            colorsBuf: null,
            flagsBuf: null,
            flags2Buf: null,
            positionsDecompressMatrix: math.mat4(),
            origin: null
        };

        // These counts are used to avoid unnecessary render passes
        this.#numPortions = 0;
        this.#numVisibleLayerPortions = 0;
        this.#numTransparentLayerPortions = 0;
        this.#numXRayedLayerPortions = 0;
        this.#numSelectedLayerPortions = 0;
        this.#numHighlightedLayerPortions = 0;
        this.#numClippableLayerPortions = 0;
        this.#numPickableLayerPortions = 0;
        this.#numCulledLayerPortions = 0;

        this.#modelAABB = math.boundaries.collapseAABB3(); // Model-space AABB
        this.#portions = [];
        this.#finalized = false;

        if (params.positionsDecompressMatrix) {
            this.state.positionsDecompressMatrix.set(params.positionsDecompressMatrix);
            this.#preCompressedPositionsExpected = true;
        } else {
            this.#preCompressedPositionsExpected = false;
        }

        if (params.origin) {
            this.state.origin = math.vec3(params.origin);
        }

        this.aabb = math.boundaries.collapseAABB3();
    }

    canCreatePortion(lenPositions: number): boolean {
        if (this.#finalized) {
            throw "Already finalized";
        }
        return ((this.#buffer.positions.length + lenPositions) < (this.#buffer.maxVerts * 3));
    }

    createPortion(params: {
        colors: math.FloatArrayType;
        colorsCompressed: math.FloatArrayType;
        positions: math.FloatArrayType;
        positionsCompressed: math.FloatArrayType;
        indices: math.FloatArrayType;
        color: math.FloatArrayType;
        opacity: number;
        meshMatrix: math.FloatArrayType;
        worldMatrix: math.FloatArrayType;
        worldAABB: math.FloatArrayType;
        pickColor: math.FloatArrayType;
    }) : number {

        if (this.#finalized) {
            throw "Already finalized";
        }

        const positions = params.positions;
        const positionsCompressed = params.positionsCompressed;
        const color = params.color;
        const colorsCompressed = params.colorsCompressed;
        const colors = params.colors;
        const meshMatrix = params.meshMatrix;
        const worldMatrix = params.worldMatrix;
        const worldAABB = params.worldAABB;
        const pickColor = params.pickColor;
        const buffer = this.#buffer;
        const positionsIndex = buffer.positions.length;
        const vertsIndex = positionsIndex / 3;

        let numVerts;

        if (this.#preCompressedPositionsExpected) {

            if (!positionsCompressed) {
                throw "positionsCompressed expected";
            }

            for (let i = 0, len = positionsCompressed.length; i < len; i++) {
                buffer.positions.push(positionsCompressed[i]);
            }

            const bounds = math.compression.getPositionsBounds(positionsCompressed);

            const min = math.compression.decompressPosition(bounds.min, this.state.positionsDecompressMatrix, tempVec3a);
            const max = math.compression.decompressPosition(bounds.max, this.state.positionsDecompressMatrix, tempVec3b);

            worldAABB[0] = min[0];
            worldAABB[1] = min[1];
            worldAABB[2] = min[2];
            worldAABB[3] = max[0];
            worldAABB[4] = max[1];
            worldAABB[5] = max[2];

            if (worldMatrix) {
                math.boundaries.AABB3ToOBB3(worldAABB, tempOBB3);
                math.boundaries.transformOBB3(worldMatrix, tempOBB3);
                math.boundaries.OBB3ToAABB3(tempOBB3, worldAABB);
            }

            numVerts = positionsCompressed.length / 3;

        } else {

            if (!positions) {
                throw "positions expected";
            }

            numVerts = positions.length / 3;

            const lenPositions = positions.length;
            const positionsBase = buffer.positions.length;

            for (let i = 0, len = positions.length; i < len; i++) {
                buffer.positions.push(positions[i]);
            }

            if (meshMatrix) {

                for (let i = positionsBase, len = positionsBase + lenPositions; i < len; i += 3) {

                    tempVec4a[0] = buffer.positions[i + 0];
                    tempVec4a[1] = buffer.positions[i + 1];
                    tempVec4a[2] = buffer.positions[i + 2];

                    math.transformPoint4(meshMatrix, tempVec4a, tempVec4b);

                    buffer.positions[i + 0] = tempVec4b[0];
                    buffer.positions[i + 1] = tempVec4b[1];
                    buffer.positions[i + 2] = tempVec4b[2];

                    math.boundaries.expandAABB3Point3(this.#modelAABB, tempVec4b);

                    if (worldMatrix) {
                        math.transformPoint4(worldMatrix, tempVec4b, tempVec4c);
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4c);
                    } else {
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4b);
                    }
                }

            } else {

                for (let i = positionsBase, len = positionsBase + lenPositions; i < len; i += 3) {

                    tempVec4a[0] = buffer.positions[i + 0];
                    tempVec4a[1] = buffer.positions[i + 1];
                    tempVec4a[2] = buffer.positions[i + 2];

                    math.boundaries.expandAABB3Point3(this.#modelAABB, tempVec4a);

                    if (worldMatrix) {
                        math.transformPoint4(worldMatrix, tempVec4a, tempVec4b);
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4b);
                    } else {
                        math.boundaries.expandAABB3Point3(worldAABB, tempVec4a);
                    }
                }
            }
        }

        if (this.state.origin) {
            const origin = this.state.origin;
            worldAABB[0] += origin[0];
            worldAABB[1] += origin[1];
            worldAABB[2] += origin[2];
            worldAABB[3] += origin[0];
            worldAABB[4] += origin[1];
            worldAABB[5] += origin[2];
        }

        math.boundaries.expandAABB3(this.aabb, worldAABB);

        if (colorsCompressed) {
            for (let i = 0, len = colorsCompressed.length; i < len; i++) {
                buffer.colors.push(colorsCompressed[i]);
            }

        } else if (colors) {
            for (let i = 0, len = colors.length; i < len; i++) {
                buffer.colors.push(colors[i] * 255);
            }

        } else if (color) {

            const r = color[0]; // Color is pre-quantized by VBOSceneModel
            const g = color[1];
            const b = color[2];
            const a = 1.0;

            for (let i = 0; i < numVerts; i++) {
                buffer.colors.push(r);
                buffer.colors.push(g);
                buffer.colors.push(b);
                buffer.colors.push(a);
            }
        }

        {
            const pickColorsBase = buffer.pickColors.length;
            const lenPickColors = numVerts * 4;
            for (let i = pickColorsBase, len = pickColorsBase + lenPickColors; i < len; i += 4) {
                buffer.pickColors.push(pickColor[0]);
                buffer.pickColors.push(pickColor[1]);
                buffer.pickColors.push(pickColor[2]);
                buffer.pickColors.push(pickColor[3]);
            }
        }

        // if (this.sceneModel.scene.entityOffsetsEnabled) {
        //     for (let i = 0; i < numVerts; i++) {
        //         buffer.offsets.push(0);
        //         buffer.offsets.push(0);
        //         buffer.offsets.push(0);
        //     }
        // }

        const portionId = this.#portions.length / 2;

        this.#portions.push(vertsIndex);
        this.#portions.push(numVerts);

        this.#numPortions++;

        return portionId;
    }

    finalize() {

        if (this.#finalized) {
            this.sceneModel.error("Already finalized");
            return;
        }

        const state = this.state;
        // @ts-ignore
        const gl = this.sceneModel.viewer.sceneRenderer.gl;
        const buffer = this.#buffer;

        if (buffer.positions.length > 0) {
            if (this.#preCompressedPositionsExpected) {
                const positions = new Uint16Array(buffer.positions);
                state.positionsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, positions, buffer.positions.length, 3, gl.STATIC_DRAW);
            } else {
                const positions = new Float32Array(buffer.positions);
                const quantizedPositions = math.compression.quantizePositions(positions, this.#modelAABB, state.positionsDecompressMatrix);
                state.positionsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, quantizedPositions, buffer.positions.length, 3, gl.STATIC_DRAW);
            }
        }

        if (buffer.colors.length > 0) {
            const colors = new Uint8Array(buffer.colors);
            let normalized = false;
            state.colorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, colors, buffer.colors.length, 4, gl.STATIC_DRAW, normalized);
        }

        if (buffer.positions.length > 0) { // Because we build flags arrays here, get their length from the positions array
            const flagsLength = (buffer.positions.length / 3) * 4;
            const flags = new Uint8Array(flagsLength);
            const flags2 = new Uint8Array(flagsLength);
            let notNormalized = false;
            let normalized = true;
            state.flagsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, flags, flags.length, 4, gl.DYNAMIC_DRAW, notNormalized);
            state.flags2Buf = new ArrayBuf(gl, gl.ARRAY_BUFFER, flags2, flags2.length, 4, gl.DYNAMIC_DRAW, normalized);
        }

        if (buffer.pickColors.length > 0) {
            const pickColors = new Uint8Array(buffer.pickColors);
            let normalized = false;
            state.pickColorsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, pickColors, buffer.pickColors.length, 4, gl.STATIC_DRAW, normalized);
        }

        // if (this.sceneModel.scene.entityOffsetsEnabled) {
        //     if (buffer.offsets.length > 0) {
        //         const offsets = new Float32Array(buffer.offsets);
        //         state.offsetsBuf = new ArrayBuf(gl, gl.ARRAY_BUFFER, offsets, buffer.offsets.length, 3, gl.DYNAMIC_DRAW);
        //     }
        // }

        this.#buffer = null;
        this.#finalized = true;
    }

    initFlags(portionId: number, flags: number, meshTransparent: boolean) {
        if (flags & ENTITY_FLAGS.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.sceneModel.numVisibleLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.sceneModel.numHighlightedLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.sceneModel.numXRayedLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.sceneModel.numSelectedLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.sceneModel.numClippableLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.sceneModel.numPickableLayerPortions++;
        }
        if (flags & ENTITY_FLAGS.CULLED) {
            this.#numCulledLayerPortions++;
            this.sceneModel.numCulledLayerPortions++;
        }
        if (meshTransparent) {
            this.#numTransparentLayerPortions++;
            this.sceneModel.numTransparentLayerPortions++;
        }
        this.#setFlags(portionId, flags, meshTransparent);
        this.#setFlags2(portionId, flags);
    }

    setVisible(portionId: number, flags: number, meshTransparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.VISIBLE) {
            this.#numVisibleLayerPortions++;
            this.sceneModel.numVisibleLayerPortions++;
        } else {
            this.#numVisibleLayerPortions--;
            this.sceneModel.numVisibleLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setHighlighted(portionId: number, flags: number, meshTransparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.HIGHLIGHTED) {
            this.#numHighlightedLayerPortions++;
            this.sceneModel.numHighlightedLayerPortions++;
        } else {
            this.#numHighlightedLayerPortions--;
            this.sceneModel.numHighlightedLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setXRayed(portionId: number, flags: number, meshTransparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.XRAYED) {
            this.#numXRayedLayerPortions++;
            this.sceneModel.numXRayedLayerPortions++;
        } else {
            this.#numXRayedLayerPortions--;
            this.sceneModel.numXRayedLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setSelected(portionId: number, flags: number, meshTransparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.SELECTED) {
            this.#numSelectedLayerPortions++;
            this.sceneModel.numSelectedLayerPortions++;
        } else {
            this.#numSelectedLayerPortions--;
            this.sceneModel.numSelectedLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setEdges(portionId: number, flags: number, meshTransparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        // Not applicable to point clouds
    }

    setClippable(portionId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.CLIPPABLE) {
            this.#numClippableLayerPortions++;
            this.sceneModel.numClippableLayerPortions++;
        } else {
            this.#numClippableLayerPortions--;
            this.sceneModel.numClippableLayerPortions--;
        }
        this.#setFlags2(portionId, flags);
    }

    setCulled(portionId: number, flags: number, meshTransparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.CULLED) {
            this.#numCulledLayerPortions++;
            this.sceneModel.numCulledLayerPortions++;
        } else {
            this.#numCulledLayerPortions--;
            this.sceneModel.numCulledLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setCollidable(portionId: number, flags: number) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
    }

    setPickable(portionId: number, flags: number, meshTransparent: boolean) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        if (flags & ENTITY_FLAGS.PICKABLE) {
            this.#numPickableLayerPortions++;
            this.sceneModel.numPickableLayerPortions++;
        } else {
            this.#numPickableLayerPortions--;
            this.sceneModel.numPickableLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    setColor(portionId: number, color: math.FloatArrayType) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        const portionsIdx = portionId * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
        const firstColor = vertexBase * 4;
        const lenColor = numVerts * 4;
        const tempArray = this.#scratchMemory.getUInt8Array(lenColor);
        const r = color[0];
        const g = color[1];
        const b = color[2];
        for (let i = 0; i < lenColor; i += 4) {
            tempArray[i + 0] = r;
            tempArray[i + 1] = g;
            tempArray[i + 2] = b;
        }
        this.state.colorsBuf.setData(tempArray, firstColor, lenColor);
    }

    setTransparent(portionId: number, flags: number, meshTransparent: boolean) {
        if (meshTransparent) {
            this.#numTransparentLayerPortions++;
            this.sceneModel.numTransparentLayerPortions++;
        } else {
            this.#numTransparentLayerPortions--;
            this.sceneModel.numTransparentLayerPortions--;
        }
        this.#setFlags(portionId, flags, meshTransparent);
    }

    #setFlags(portionId: number, flags: number, meshTransparent: boolean) {

        if (!this.#finalized) {
            throw "Not finalized";
        }

        const portionsIdx = portionId * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
        const firstFlag = vertexBase * 4;
        const lenFlags = numVerts * 4;
        const tempArray = this.#scratchMemory.getUInt8Array(lenFlags);

        const visible = !!(flags & ENTITY_FLAGS.VISIBLE);
        const xrayed = !!(flags & ENTITY_FLAGS.XRAYED);
        const highlighted = !!(flags & ENTITY_FLAGS.HIGHLIGHTED);
        const selected = !!(flags & ENTITY_FLAGS.SELECTED);
        const pickable = !!(flags & ENTITY_FLAGS.PICKABLE);
        const culled = !!(flags & ENTITY_FLAGS.CULLED);

        // Normal fill

        let f0;
        if (!visible || culled || xrayed || highlighted || selected) {
            f0 = RENDER_PASSES.NOT_RENDERED;
        } else {
            if (meshTransparent) {
                f0 = RENDER_PASSES.COLOR_TRANSPARENT;
            } else {
                f0 = RENDER_PASSES.COLOR_OPAQUE;
            }
        }

        // Emphasis fill

        let f1;
        if (!visible || culled) {
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

        // Pick

        let f3 = (visible && !culled && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;

        for (let i = 0; i < lenFlags; i += 4) {
            tempArray[i + 0] = f0; // x - normal fill
            tempArray[i + 1] = f1; // y - emphasis fill
            tempArray[i + 2] = 0; // z - edges - don't care
            tempArray[i + 3] = f3; // w - pick
        }

        this.state.flagsBuf.setData(tempArray, firstFlag, lenFlags);
    }

    #setFlags2(portionId: number, flags: number) {

        if (!this.#finalized) {
            throw "Not finalized";
        }

        const portionsIdx = portionId * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
        const firstFlag = vertexBase * 4;
        const lenFlags = numVerts * 4;
        const tempArray = this.#scratchMemory.getUInt8Array(lenFlags);

        const clippable = !!(flags & ENTITY_FLAGS.CLIPPABLE) ? 255 : 0;

        for (let i = 0; i < lenFlags; i += 4) {
            tempArray[i + 0] = clippable;
        }

        this.state.flags2Buf.setData(tempArray, firstFlag, lenFlags);
    }

    setOffset(portionId: number, offset: math.FloatArrayType) {
        if (!this.#finalized) {
            throw "Not finalized";
        }
        // if (!this.sceneModel.scene.entityOffsetsEnabled) {
        //     this.sceneModel.error("Entity#offset not enabled for this Viewer"); // See Viewer entityOffsetsEnabled
        //     return;
        // }
        const portionsIdx = portionId * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
        const firstOffset = vertexBase * 3;
        const lenOffsets = numVerts * 3;
        const tempArray = this.#scratchMemory.getFloat32Array(lenOffsets);
        const x = offset[0];
        const y = offset[1];
        const z = offset[2];
        for (let i = 0; i < lenOffsets; i += 3) {
            tempArray[i + 0] = x;
            tempArray[i + 1] = y;
            tempArray[i + 2] = z;
        }
        this.state.offsetsBuf.setData(tempArray, firstOffset, lenOffsets);
    }

    //-- NORMAL RENDERING ----------------------------------------------------------------------------------------------

    drawColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === this.#numPortions || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        if (this.#pointsBatchingRenderers.colorRenderer) {
            this.#pointsBatchingRenderers.colorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    drawColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numTransparentLayerPortions === 0 || this.#numXRayedLayerPortions === this.#numPortions) {
            return;
        }
        if (this.#pointsBatchingRenderers.colorRenderer) {
            this.#pointsBatchingRenderers.colorRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_TRANSPARENT);
        }
    }

    // -- RENDERING SAO POST EFFECT TARGETS ----------------------------------------------------------------------------

    drawDepth(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawNormals(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    // -- EMPHASIS RENDERING -------------------------------------------------------------------------------------------

    drawSilhouetteXRayed(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numXRayedLayerPortions === 0) {
            return;
        }
        if (this.#pointsBatchingRenderers.silhouetteRenderer) {
            this.#pointsBatchingRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numHighlightedLayerPortions === 0) {
            return;
        }
        if (this.#pointsBatchingRenderers.silhouetteRenderer) {
            this.#pointsBatchingRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0 || this.#numSelectedLayerPortions === 0) {
            return;
        }
        if (this.#pointsBatchingRenderers.silhouetteRenderer) {
            this.#pointsBatchingRenderers.silhouetteRenderer.drawLayer(frameContext, this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    //-- EDGES RENDERING -----------------------------------------------------------------------------------------------

    drawEdgesColorOpaque(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawEdgesColorTransparent(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawEdgesHighlighted(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawEdgesSelected(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    drawEdgesXRayed(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    //---- PICKING ----------------------------------------------------------------------------------------------------

    drawPickMesh(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        if (this.#pointsBatchingRenderers.pickMeshRenderer) {
            this.#pointsBatchingRenderers.pickMeshRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    drawPickDepths(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        if (this.#pointsBatchingRenderers.pickDepthRenderer) {
            this.#pointsBatchingRenderers.pickDepthRenderer.drawLayer(frameContext, this, RENDER_PASSES.PICK);
        }
    }

    drawPickNormals(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    //---- OCCLUSION TESTING -------------------------------------------------------------------------------------------

    drawOcclusion(drawFlags: DrawFlags, frameContext: FrameContext): void {
        if (this.#numCulledLayerPortions === this.#numPortions || this.#numVisibleLayerPortions === 0) {
            return;
        }
        if (this.#pointsBatchingRenderers.occlusionRenderer) {
            this.#pointsBatchingRenderers.occlusionRenderer.drawLayer(frameContext, this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    //---- SHADOWS -----------------------------------------------------------------------------------------------------

    drawShadow(drawFlags: DrawFlags, frameContext: FrameContext): void {
    }

    destroy() {
        const state = this.state;
        if (state.positionsBuf) {
            state.positionsBuf.destroy();
            state.positionsBuf = null;
        }
        if (state.offsetsBuf) {
            state.offsetsBuf.destroy();
            state.offsetsBuf = null;
        }
        if (state.colorsBuf) {
            state.colorsBuf.destroy();
            state.colorsBuf = null;
        }
        if (state.flagsBuf) {
            state.flagsBuf.destroy();
            state.flagsBuf = null;
        }
        if (state.flags2Buf) {
            state.flags2Buf.destroy();
            state.flags2Buf = null;
        }
        if (state.pickColorsBuf) {
            state.pickColorsBuf.destroy();
            state.pickColorsBuf = null;
        }
        state.destroy();
    }
}
