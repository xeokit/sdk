import {Layer} from "../../Layer";
import {View} from "@xeokit/viewer";
import {WebGLRendererModel} from "../../WebGLRendererModel";
import {MeshCounts} from "../../MeshCounts";
import {FloatArrayParam} from "@xeokit/math";
import {createMat4, createVec3, identityMat4} from "@xeokit/matrix";
import {collapseAABB3, expandAABB3} from "@xeokit/boundaries";
import {SDKError} from "@xeokit/core";
import {LayerMeshParams} from "../../LayerMeshParams";
import {SceneGeometry, SceneMesh} from "@xeokit/scene";
import {VBOPointsBuffer} from "./VBOPointsBuffer";
import {VBOPointsRenderState} from "./VBOPointsRenderState";
import {getRenderers, VBOPointsRendererSet} from "./VBOPointsRendererSet";

import {SCENE_OBJECT_FLAGS} from "../../SCENE_OBJECT_FLAGS";
import {RENDER_PASSES} from "../../RENDER_PASSES";
import {WebGLArrayBuf} from "@xeokit/webglutils";
import {RenderContext} from "../../RenderContext";
import {getScratchMemory, putScratchMemory} from "../ScratchMemory";
import {LayerParams} from "../../LayerParams";

const tempMat4a = <Float64Array>identityMat4();
const tempUint8Array4 = new Uint8Array(4);

let numLayers = 0;

const DEFAULT_MATRIX = identityMat4();


/**
 * @private
 */
export class VBOPointsLayer implements Layer {

    gl: WebGL2RenderingContext;
    primitive: number;
    view: View;
    rendererModel: WebGLRendererModel;
    layerIndex: number;
    meshCounts: MeshCounts;
    renderState: VBOPointsRenderState;
    sortId: string;

    #built: boolean;
    #aabb: FloatArrayParam;
    aabbDirty: boolean;
    #meshes: any[];                 // A Mesh has multiple SubMeshes
    #layerNumber: number;

    #deferredAttributesUpdateEnabled: boolean;
    #deferredMatricesUpdateEnabled: boolean;

    #deferredAttributesUpdateDirty: boolean;
    #deferredMatricesUpdateDirty: boolean;

    #countAttributesUpdateInFrame: number;
    #countMatricesUpdateInFrame: number;

    #onViewerTick: () => void;
    #scratchMemory: any;
    #vboPointsBuffer: VBOPointsBuffer;
    #rendererSet: VBOPointsRendererSet;
    renderContext: RenderContext;
    #portions: number[];

    constructor(layerParams: LayerParams) {

        this.renderContext = layerParams.renderContext;
        this.gl = layerParams.gl;
        this.primitive = layerParams.primitive;
        this.view = layerParams.view;
        this.rendererModel = layerParams.rendererModel;
        this.layerIndex = layerParams.layerIndex;
        this.sortId = `points-vbo-${this.#layerNumber}-${layerParams.primitive}`;
        this.meshCounts = new MeshCounts();
        this.#layerNumber = numLayers++;
        this.#portions = [];

        this.#rendererSet = getRenderers(this.renderContext.webglRenderer);

        this.#vboPointsBuffer = new VBOPointsBuffer();
        this.#scratchMemory = getScratchMemory();

        this.#built = false;
        this.#aabb = collapseAABB3(); // Model-space AABB
        this.aabbDirty = true;

        this.renderState = <VBOPointsRenderState>{
            numVertices: 0,
            positionsBuf: null,
            offsetsBuf: null,
            colorsBuf: null,
            flagsBuf: null,
            positionsDecodeMatrix: createMat4(),
            origin: createVec3()
        };
    }

    get hash() {
        return `points`;
    }

    get aabb() {
        if (this.aabbDirty) {
            collapseAABB3(this.#aabb);
            for (let i = 0, len = this.#meshes.length; i < len; i++) {
                expandAABB3(this.#aabb, this.#meshes[i].aabb);
            }
            this.aabbDirty = false;
        }
        return this.#aabb;
    }

    canCreateLayerMesh(sceneGeometry: SceneGeometry): boolean {
        if (this.#built) {
            throw new SDKError("Already built");
        }
        let numVertices = 0;
        sceneGeometry.geometryBuckets.forEach(bucket => {
            numVertices += bucket.positionsCompressed.length;
        });
        return ((this.#vboPointsBuffer.positions.length + numVertices) < (this.#vboPointsBuffer.maxVerts * 3));
    }

    createLayerMesh(layerMeshParams: LayerMeshParams, sceneMesh: SceneMesh): number {
        if (this.#built) {
            throw new SDKError("Already built");
        }

        const geometry = sceneMesh.geometry;
        const geometryBucket = geometry.geometryBuckets[0];
        const positionsCompressed = geometryBucket.positionsCompressed;
        const color = sceneMesh.color;
        const colorsCompressed = geometryBucket.colorsCompressed;

        const pickColor = layerMeshParams.pickColor;

        const buffer = this.#vboPointsBuffer;
        const positionsIndex = buffer.positions.length;
        const vertsIndex = positionsIndex / 3;

        let numVerts;

        expandAABB3(this.#aabb, geometry.aabb);

        if (!positionsCompressed) {
            throw "positionsCompressed expected";
        }

        for (let i = 0, len = positionsCompressed.length; i < len; i++) {
            buffer.positions.push(positionsCompressed[i]);
        }

        numVerts = positionsCompressed.length / 3;

        if (colorsCompressed) {
            for (let i = 0, len = colorsCompressed.length; i < len; i++) {
                buffer.colors.push(colorsCompressed[i]);
            }

//        }
            // else if (colors) {
            //     for (let i = 0, len = colors.length; i < len; i++) {
            //         buffer.colors.push(colors[i] * 255);
            //     }

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

        const layerMeshIndex = this.#portions.length / 2;

        this.#portions.push(vertsIndex);
        this.#portions.push(numVerts);

        this.meshCounts.numMeshes++;
        this.rendererModel.meshCounts.numMeshes++;
        return layerMeshIndex;
    }

    /**
     * Builds batch VBOs from appended geometries.
     * No more portions can then be created.
     */
    build() {

        if (this.#built) {
            throw new SDKError("Already built");
        }

        const state = this.renderState;
        const gl = this.gl;
        const buffer = this.#vboPointsBuffer;

        if (buffer.positions.length > 0) {
            //  if (this.#preCompressedPositionsExpected) {
            const positions = new Uint16Array(buffer.positions);
            state.positionsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, positions, buffer.positions.length, 3, gl.STATIC_DRAW);
            // } else {
            //     const positions = new Float32Array(buffer.positions);
            //     const quantizedPositions = quantizePositions(positions, this.#aabb, state.positionsDecodeMatrix);
            //     state.positionsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, quantizedPositions, buffer.positions.length, 3, gl.STATIC_DRAW);
            // }
        }

        if (buffer.colors.length > 0) {
            const colors = new Uint8Array(buffer.colors);
            let normalized = false;
            state.colorsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, colors, buffer.colors.length, 4, gl.STATIC_DRAW, normalized);
        }

        if (buffer.positions.length > 0) { // Because we build flags arrays here, get their length from the positions array
            const flagsLength = buffer.positions.length / 3;
            const flags = new Float32Array(flagsLength);
            let notNormalized = false;
            state.flagsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, flags, flags.length, 1, gl.DYNAMIC_DRAW, notNormalized);
        }

        if (buffer.pickColors.length > 0) {
            const pickColors = new Uint8Array(buffer.pickColors);
            let normalized = false;
            state.pickColorsBuf = new WebGLArrayBuf(gl, gl.ARRAY_BUFFER, pickColors, buffer.pickColors.length, 4, gl.STATIC_DRAW, normalized);
        }

        this.#vboPointsBuffer = null;
        this.#built = true;
    }

    initFlags(layerMeshIndex: number, flags: number, transparent: boolean) {
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            this.meshCounts.numVisible++;
            this.rendererModel.meshCounts.numVisible++;
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.meshCounts.numHighlighted++;
            this.rendererModel.meshCounts.numHighlighted++;
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.meshCounts.numXRayed++;
            this.rendererModel.meshCounts.numXRayed++;
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.meshCounts.numSelected++;
            this.rendererModel.meshCounts.numSelected++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.meshCounts.numClippable++;
            this.rendererModel.meshCounts.numClippable++;
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts.numPickable++;
            this.rendererModel.meshCounts.numPickable++;
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts.numCulled++;
            this.rendererModel.meshCounts.numCulled++;
        }
        if (transparent) {
            this.meshCounts.numTransparent++;
            this.rendererModel.meshCounts.numTransparent++;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshVisible(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.VISIBLE) {
            this.meshCounts.numVisible++;
            this.rendererModel.meshCounts.numVisible++;
        } else {
            this.meshCounts.numVisible--;
            this.rendererModel.meshCounts.numVisible--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshHighlighted(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED) {
            this.meshCounts.numHighlighted++;
            this.rendererModel.meshCounts.numHighlighted++;
        } else {
            this.meshCounts.numHighlighted--;
            this.rendererModel.meshCounts.numHighlighted--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshXRayed(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.XRAYED) {
            this.meshCounts.numXRayed++;
            this.rendererModel.meshCounts.numXRayed++;
        } else {
            this.meshCounts.numXRayed--;
            this.rendererModel.meshCounts.numXRayed--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshSelected(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.SELECTED) {
            this.meshCounts.numSelected++;
            this.rendererModel.meshCounts.numSelected++;
        } else {
            this.meshCounts.numSelected--;
            this.rendererModel.meshCounts.numSelected--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshEdges(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        // Not applicable to point clouds
    }

    setLayerMeshClippable(layerMeshIndex: number, flags: number): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.CLIPPABLE) {
            this.meshCounts.numClippable++;
            this.rendererModel.meshCounts.numClippable++;
        } else {
            this.meshCounts.numClippable--;
            this.rendererModel.meshCounts.numClippable--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags);
    }

    setLayerMeshCulled(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.CULLED) {
            this.meshCounts.numCulled++;
            this.rendererModel.meshCounts.numCulled++;
        } else {
            this.meshCounts.numCulled--;
            this.rendererModel.meshCounts.numCulled--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshCollidable(layerMeshIndex: number, flags: number): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
    }

    setLayerMeshPickable(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        if (flags & SCENE_OBJECT_FLAGS.PICKABLE) {
            this.meshCounts.numPickable++;
            this.rendererModel.meshCounts.numPickable++;
        } else {
            this.meshCounts.numPickable--;
            this.rendererModel.meshCounts.numPickable--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshColor(layerMeshIndex: number, color: FloatArrayParam): void {
        if (!this.#built) {
            throw new SDKError("Not built");
        }
        const portionsIdx = layerMeshIndex * 2;
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
        this.renderState.colorsBuf.setData(tempArray, firstColor);
    }

    setLayerMeshTransparent(layerMeshIndex: number, flags: number, transparent: boolean): void {
        if (transparent) {
            this.meshCounts.numTransparent++;
            this.rendererModel.meshCounts.numTransparent++;
        } else {
            this.meshCounts.numTransparent--;
            this.rendererModel.meshCounts.numTransparent--;
        }
        this.setLayerMeshFlags(layerMeshIndex, flags, transparent);
    }

    setLayerMeshFlags(layerMeshIndex: number, flags: number, transparent: boolean = false): void {

        if (!this.#built) {
            throw new SDKError("Not built");
        }

        const portionsIdx = layerMeshIndex * 2;
        const vertexBase = this.#portions[portionsIdx];
        const numVerts = this.#portions[portionsIdx + 1];
        const firstFlag = vertexBase;
        const lenFlags = numVerts;
        const tempArray = this.#scratchMemory.getFloat32Array(lenFlags);

        const visible = !!(flags & SCENE_OBJECT_FLAGS.VISIBLE);
        const xrayed = !!(flags & SCENE_OBJECT_FLAGS.XRAYED);
        const highlighted = !!(flags & SCENE_OBJECT_FLAGS.HIGHLIGHTED);
        const selected = !!(flags & SCENE_OBJECT_FLAGS.SELECTED);
        const pickable = !!(flags & SCENE_OBJECT_FLAGS.PICKABLE);
        const culled = !!(flags & SCENE_OBJECT_FLAGS.CULLED);

        let colorFlag;
        if (!visible || culled || xrayed
            || (highlighted && !this.renderContext.view.highlightMaterial.glowThrough)
            || (selected && !this.renderContext.view.selectedMaterial.glowThrough)) {
            colorFlag = RENDER_PASSES.NOT_RENDERED;
        } else {
            if (transparent) {
                colorFlag = RENDER_PASSES.COLOR_TRANSPARENT;
            } else {
                colorFlag = RENDER_PASSES.COLOR_OPAQUE;
            }
        }

        let silhouetteFlag;
        if (!visible || culled) {
            silhouetteFlag = RENDER_PASSES.NOT_RENDERED;
        } else if (selected) {
            silhouetteFlag = RENDER_PASSES.SILHOUETTE_SELECTED;
        } else if (highlighted) {
            silhouetteFlag = RENDER_PASSES.SILHOUETTE_HIGHLIGHTED;
        } else if (xrayed) {
            silhouetteFlag = RENDER_PASSES.SILHOUETTE_XRAYED;
        } else {
            silhouetteFlag = RENDER_PASSES.NOT_RENDERED;
        }

        let pickFlag = (visible && !culled && pickable) ? RENDER_PASSES.PICK : RENDER_PASSES.NOT_RENDERED;

        const clippableFlag = !!(flags & SCENE_OBJECT_FLAGS.CLIPPABLE) ? 1 : 0;

        for (let i = 0; i < lenFlags; i++) {
            let vertFlag = 0;
            vertFlag |= colorFlag;
            vertFlag |= silhouetteFlag << 4;
            // no edges
            vertFlag |= pickFlag << 12;
            vertFlag |= clippableFlag << 16;

            tempArray[i] = vertFlag;
        }

        this.renderState.flagsBuf.setData(tempArray, firstFlag);
    }

    setLayerMeshMatrix(layerMeshIndex: number, matrix: FloatArrayParam): void {
    }

    setLayerMeshOffset(layerMeshIndex: number, offset: FloatArrayParam): void {
    }

    // setOffset(layerMeshIndex: number, offset: number) {
    //     if (!this.#built) {
    //         throw new SDKError("Not built");
    //     }
    //     // if (!this.renderContext.view.entityOffsetsEnabled) {
    //     this.rendererModel.error("Entity#offset not enabled for this Viewer"); // See Viewer entityOffsetsEnabled
    //     return;
    //     //}
    //     const portionsIdx = layerMeshIndex * 2;
    //     const vertexBase = this.#portions[portionsIdx];
    //     const numVerts = this.#portions[portionsIdx + 1];
    //     const firstOffset = vertexBase * 3;
    //     const lenOffsets = numVerts * 3;
    //     const tempArray = this.#scratchMemory.getFloat32Array(lenOffsets);
    //     const x = offset[0];
    //     const y = offset[1];
    //     const z = offset[2];
    //     for (let i = 0; i < lenOffsets; i += 3) {
    //         tempArray[i + 0] = x;
    //         tempArray[i + 1] = y;
    //         tempArray[i + 2] = z;
    //     }
    //     this.renderState.offsetsBuf.setData(tempArray, firstOffset);
    // }

    drawColorOpaque() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === this.meshCounts.numMeshes ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.draw(this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    drawColorTranslucent() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === 0 ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        if (this.#rendererSet.colorRenderer) {
            this.#rendererSet.colorRenderer.draw(this, RENDER_PASSES.COLOR_TRANSPARENT);
        }
    }

    drawDepth() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === this.meshCounts.numMeshes ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        // if (this.#rendererSet.depthRenderer) {
        //     this.#rendererSet.depthRenderer.draw(this, RENDER_PASSES.COLOR_OPAQUE); // Assume whatever post-effect uses depth (eg SAO) does not apply to transparent objects
        // }
    }

    drawNormals() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numTransparent === this.meshCounts.numMeshes ||
            this.meshCounts.numXRayed === this.meshCounts.numMeshes) {
            return;
        }
        // if (this.#rendererSet.normalsRenderer) {
        //     this.#rendererSet.normalsRenderer.draw(this, RENDER_PASSES.COLOR_OPAQUE);  // Assume whatever post-effect uses normals (eg SAO) does not apply to transparent objects
        // }
    }

    drawSilhouetteXRayed() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numXRayed === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.draw(this, RENDER_PASSES.SILHOUETTE_XRAYED);
        }
    }

    drawSilhouetteHighlighted() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numHighlighted === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.draw(this, RENDER_PASSES.SILHOUETTE_HIGHLIGHTED);
        }
    }

    drawSilhouetteSelected() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0 ||
            this.meshCounts.numSelected === 0) {
            return;
        }
        if (this.#rendererSet.silhouetteRenderer) {
            this.#rendererSet.silhouetteRenderer.draw(this, RENDER_PASSES.SILHOUETTE_SELECTED);
        }
    }

    drawEdgesColorOpaque() {
    }

    drawEdgesColorTranslucent() {
    }

    drawEdgesHighlighted() {
    }

    drawEdgesSelected() {
    }

    drawEdgesXRayed() {
    }

    drawOcclusion() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
            this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.occlusionRenderer) {
            this.#rendererSet.occlusionRenderer.draw(this, RENDER_PASSES.COLOR_OPAQUE);
        }
    }

    drawShadow() {
        // if (this.meshCounts.numCulled === this.meshCounts.numMeshes ||
        //     this.meshCounts.numVisible === 0) {
        //     return;
        // }
        // if (this.#rendererSet.shadowRenderer) {
        //     this.#rendererSet.shadowRenderer.draw( this, RENDER_PASSES.COLOR_OPAQUE);
        // }
    }

    drawPickMesh() {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.pickMeshRenderer) {
            this.#rendererSet.pickMeshRenderer.draw(this, RENDER_PASSES.PICK);
        }
    }

    drawPickDepths() {
        if (this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.pickDepthRenderer) {
            this.#rendererSet.pickDepthRenderer.draw(this, RENDER_PASSES.PICK);
        }
    }

    drawSnapInit() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.snapInitRenderer) {
            this.#rendererSet.snapInitRenderer.draw(this, RENDER_PASSES.PICK);
        }
    }

    drawSnap() {
        if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0) {
            return;
        }
        if (this.#rendererSet.snapRenderer) {
            this.#rendererSet.snapRenderer.draw(this, RENDER_PASSES.PICK);
        }
    }

    drawPickNormals() {
        // if (this.meshCounts.numCulled === this.meshCounts.numMeshes || this.meshCounts.numVisible === 0) {
        //     return;
        // }
        // if (this.#rendererSet.pickNormalsRenderer) {
        //     this.#rendererSet.pickNormalsRenderer.draw( this, RENDER_PASSES.PICK);
        // }
    }

    destroy() {
        const state = this.renderState;
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
        if (state.pickColorsBuf) {
            state.pickColorsBuf.destroy();
            state.pickColorsBuf = null;
        }
        //state.destroy();
        putScratchMemory();
    }

    commitRendererState(): void {
    }

    isEmpty(): boolean {
        return false;
    }


}
