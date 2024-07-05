// import {WebGLProgram} from "../../../webgl/WebGLProgram";
// import {OcclusionLayer} from "./OcclusionLayer";
//
//
// import {View, Scene, CustomProjection, math} from "../../../../viewer/index";
//
// const TEST_MODE = false;
// const MARKER_COLOR = math.createVec3([1.0, 0.0, 0.0]);
// const POINT_SIZE = 20;
// const MARKER_SPRITE_CLIPZ_OFFSET = -0.001; // Amount that we offset sprite clip Z coords to raise them from surfaces
//
// const tempVec3a = math.createVec3();
//
// /**
//  * Manages occlusion testing. Private member of a Renderer.
//  */
// class OcclusionTester {
//
//     constructor(scene, renderBufferManager) {
//
//         this.#scene = scene;
//
//         this._renderBufferManager = renderBufferManager;
//
//         this._occlusionLayers = {};
//         this._occlusionLayersList = [];
//         this._occlusionLayersListDirty = false;
//
//         this._shaderSource = null;
//         this.#program = null;
//
//         this._shaderSourceHash = null;
//
//         this._shaderSourceDirty = true;         // Need to build shader source code ?
//         this.#programDirty = false;             // Need to build shader program ?
//
//         this._markersToOcclusionLayersMap = {};
//
//         this._onCameraViewMatrix = scene.camera.on("viewMatrix", () => {
//             this._occlusionTestListDirty = true;
//         });
//
//         this._onCameraProjMatrix = scene.camera.on("projMatrix", () => {
//             this._occlusionTestListDirty = true;
//         });
//
//         this._onViewBoundary = scene.canvas.on("boundary", () => {
//             this._occlusionTestListDirty = true;
//         });
//     }
//
//     /**
//      * Adds a Marker for occlusion testing.
//      * @param marker
//      */
//     addMarker(marker) {
//         const originHash = marker.origin.join();
//         let occlusionLayer = this._occlusionLayers[originHash];
//         if (!occlusionLayer) {
//             occlusionLayer = new OcclusionLayer(this.#scene, marker.origin);
//             this._occlusionLayers[occlusionLayer.originHash] = occlusionLayer;
//             this._occlusionLayersListDirty = true;
//         }
//         occlusionLayer.addMarker(marker);
//         this._markersToOcclusionLayersMap[marker.id] = occlusionLayer;
//         this._occlusionTestListDirty = true;
//     }
//
//     /**
//      * Notifies OcclusionTester that a Marker has updated its World-space position.
//      * @param marker
//      */
//     markerWorldPosUpdated(marker) {
//         const occlusionLayer = this._markersToOcclusionLayersMap[marker.id];
//         if (!occlusionLayer) {
//             marker.error("Marker has not been added to OcclusionTester");
//             return;
//         }
//         const originHash = marker.origin.join();
//         if (originHash !== occlusionLayer.originHash) {
//             if (occlusionLayer.numMarkers === 1) {
//                 occlusionLayer.destroy();
//                 delete this._occlusionLayers[occlusionLayer.originHash];
//                 this._occlusionLayersListDirty = true;
//             } else {
//                 occlusionLayer.removeMarker(marker);
//             }
//             let newOcclusionLayer = this._occlusionLayers[originHash];
//             if (!newOcclusionLayer) {
//                 newOcclusionLayer = new OcclusionLayer(this.#scene, marker.origin);
//                 this._occlusionLayers[originHash] = occlusionLayer;
//                 this._occlusionLayersListDirty = true;
//             }
//             newOcclusionLayer.addMarker(marker);
//             this._markersToOcclusionLayersMap[marker.id] = newOcclusionLayer;
//         } else {
//             occlusionLayer.markerWorldPosUpdated(marker);
//         }
//     }
//
//     /**
//      * Removes a Marker from occlusion testing.
//      * @param marker
//      */
//     removeMarker(marker) {
//         const originHash = marker.origin.join();
//         let occlusionLayer = this._occlusionLayers[originHash];
//         if (!occlusionLayer) {
//             return;
//         }
//         if (occlusionLayer.numMarkers === 1) {
//             occlusionLayer.destroy();
//             delete this._occlusionLayers[occlusionLayer.originHash];
//             this._occlusionLayersListDirty = true;
//         } else {
//             occlusionLayer.removeMarker(marker);
//         }
//         delete this._markersToOcclusionLayersMap[marker.id];
//     }
//
//     /**
//      * Returns true if an occlusion test is needed.
//      *
//      * @returns {boolean}
//      */
//     get needOcclusionTest() {
//         return this._occlusionTestListDirty;
//     }
//
//     /**
//      * Binds the render buffer. After calling this, the caller then renders object silhouettes to the render buffer,
//      * then calls drawMarkers() and doOcclusionTest().
//      */
//     bindRenderBuf() {
//
//         const shaderSourceHash = [this.#scene.canvas.canvas.id, this.#scene.#sectionPlanesState.getHash()].join(";");
//
//         if (shaderSourceHash !== this._shaderSourceHash) {
//             this._shaderSourceHash = shaderSourceHash;
//             this._shaderSourceDirty = true;
//         }
//
//         if (this._shaderSourceDirty) {
//             this._buildShaderSource();
//             this._shaderSourceDirty = false;
//             this.#programDirty = true;
//         }
//
//         if (this.#programDirty) {
//             this._buildProgram();
//             this.#programDirty = false;
//             this._occlusionTestListDirty = true;
//         }
//
//         if (this._occlusionLayersListDirty) {
//             this._buildOcclusionLayersList();
//             this._occlusionLayersListDirty = false;
//         }
//
//         if (this._occlusionTestListDirty) {
//             for (let i = 0, len = this._occlusionLayersList.length; i < len; i++) {
//                 const occlusionLayer = this._occlusionLayersList[i];
//                 occlusionLayer.occlusionTestListDirty = true;
//             }
//             this._occlusionTestListDirty = false;
//         }
//
//         if (!TEST_MODE) {
//             this._readPixelBuf = this._renderBufferManager.getRenderBuffer("occlusionReadPix");
//             this._readPixelBuf.bind();
//             this._readPixelBuf.clear();
//         }
//     }
//
//     _buildOcclusionLayersList() {
//         let numOcclusionLayers = 0;
//         for (let originHash in this._occlusionLayers) {
//             if (this._occlusionLayers.hasOwnProperty(originHash)) {
//                 this._occlusionLayersList[numOcclusionLayers++] = this._occlusionLayers[originHash];
//             }
//         }
//         this._occlusionLayersList.length = numOcclusionLayers;
//     }
//
//     _buildShaderSource() {
//         this._shaderSource = {
//             vertex: this._buildVertexShaderSource(),
//             fragment: this._buildFragmentShaderSource()
//         };
//     }
//
//     _buildVertexShaderSource() {
//         const scene = this.#scene;
//         const clipping = this.view.sectionPlanesList.length > 0;
//         const src = [];
//         src.push("#version 300 es");
//         src.push("// OcclusionTester vertex shader");
//
//         src.push("in createVec3 position;");
//         src.push("uniform createMat4 modelMatrix;");
//         src.push("uniform createMat4 viewMatrix;");
//         src.push("uniform createMat4 projMatrix;");
//         if (this.view.logarithmicDepthBufferEnabled) {
//             src.push("uniform float logDepthBufFC;");
//             src.push("out float vFragDepth;");
//         }
//         if (clipping) {
//             src.push("out createVec4 vWorldPosition;");
//         }
//         src.push("void main(void) {");
//         src.push("createVec4 worldPosition = createVec4(position, 1.0); ");
//         src.push("   createVec4 viewPosition = viewMatrix * worldPosition;");
//         if (clipping) {
//             src.push("   vWorldPosition = worldPosition;");
//         }
//         src.push("   createVec4 clipPos = projMatrix * viewPosition;
//         src.push("   gl_PointSize = " + POINT_SIZE + ".0;");
//         if (this.view.logarithmicDepthBufferEnabled) {
//             src.push("vFragDepth = 1.0 + clipPos.w;");
//         } else {
//             src.push("clipPos.z += " + MARKER_SPRITE_CLIPZ_OFFSET + ";");
//         }
//         src.push("   gl_Position = clipPos;");
//         src.push("}");
//         return src.join("\n");
//     }
//
//     _buildFragmentShaderSource() {
//         const scene = this.#scene;
//         const sectionPlanesState = scene.#sectionPlanesState;
//         const clipping = this.view.sectionPlanesList.length > 0;
//         const src = [];
//         src.push("#version 300 es");
//         src.push("// OcclusionTester fragment shader");
//
//         src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
//         src.push("precision highp float;");
//         src.push("precision highp int;");
//         src.push("#else");
//         src.push("precision mediump float;");
//         src.push("precision mediump int;");
//         src.push("#endif");
//         if (this.view.logarithmicDepthBufferEnabled) {
//             src.push("uniform float logDepthBufFC;");
//             src.push("in float vFragDepth;");
//         }
//         if (clipping) {
//             src.push("in createVec4 vWorldPosition;");
//             for (let i = 0; i < this.view.sectionPlanesList.length; i++) {
//                 src.push("uniform bool sectionPlaneActive" + i + ";");
//                 src.push("uniform createVec3 sectionPlanePos" + i + ";");
//                 src.push("uniform createVec3 sectionPlaneDir" + i + ";");
//             }
//         }
//         src.push("out createVec4 outColor;");
//         src.push("void main(void) {");
//         if (clipping) {
//             src.push("  float dist = 0.0;");
//             for (var i = 0; i < this.view.sectionPlanesList.length; i++) {
//                 src.push("if (sectionPlaneActive" + i + ") {");
//                 src.push("   dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
//                 src.push("}");
//             }
//             src.push("  if (dist > 0.0) { discard; }");
//         }
//         if (this.view.logarithmicDepthBufferEnabled) {
//             src.push("gl_FragDepth = log2( vFragDepth ) * logDepthBufFC * 0.5;");
//         }
//         src.push("   outColor = createVec4(1.0, 0.0, 0.0, 1.0); ");
//         src.push("}");
//         return src.join("\n");
//     }
//
//     _buildProgram() {
//         if (this.#program) {
//             this.#program.destroy();
//         }
//         const scene = this.#scene;
//         const gl =   this.renderContext.gl;;
//         const sectionPlanesState = scene.#sectionPlanesState;
//         this.#program = new WebGLProgram(gl, this._shaderSource);
//         if (this.#program.errors) {
//             this.errors = this.#program.errors;
//             return;
//         }
//         const program = this.#program;
//         this.#uViewMatrix = program.getLocation("viewMatrix");
//         this.#uProjMatrix = program.getLocation("projMatrix");
//         this.#uSectionPlanes = [];
//         const sectionPlanes = sectionPlanesState.sectionPlanes;
//         for (let i = 0, len = sectionPlanes.length; i < len; i++) {
//             this.#uSectionPlanes.push({
//                 active: program.getLocation("sectionPlaneActive" + i),
//                 pos: program.getLocation("sectionPlanePos" + i),
//                 dir: program.getLocation("sectionPlaneDir" + i)
//             });
//         }
//         this._aPosition = program.getAttribute("position");
//         if (this.view.logarithmicDepthBufferEnabled) {
//             this.#uLogDepthBufFC = program.getLocation("logDepthBufFC");
//         }
//     }
//
//     /**
//      * Draws {@link Marker}s to the render buffer.
//      */
//     drawMarkers() {
//
//         const scene = this.#scene;
//         const gl =   this.renderContext.gl;;
//         const program = this.#program;
//         const sectionPlanesState = scene.#sectionPlanesState;
//         const camera = scene.camera;
//         const project = scene.camera.project;
//
//         program.bind();
//
//         gl.uniformMatrix4fv(this.#uProjMatrix, false, camera._project.state.matrix);
//
//         if (this.view.logarithmicDepthBufferEnabled) {
//             const logDepthBufFC = 2.0 / (Math.log(project.far + 1.0) / Math.LN2);
//             gl.uniform1f(this.#uLogDepthBufFC, logDepthBufFC);
//         }
//
//         for (let i = 0, len = this._occlusionLayersList.length; i < len; i++) {
//
//             const occlusionLayer = this._occlusionLayersList[i];
//
//             occlusionLayer.update();
//
//             if (occlusionLayer.culledBySectionPlanes) {
//                 continue;
//             }
//
//             const origin = occlusionLayer.origin;
//
//             gl.uniformMatrix4fv(this.#uViewMatrix, false, createRTCViewMat(camera.viewMatrix, origin));
//
//             const numSectionPlanes = this.view.sectionPlanesList.length;
//             if (numSectionPlanes > 0) {
//                 const sectionPlanes = sectionPlanesState.sectionPlanes;
//                 for (let sectionPlaneIndex = 0; sectionPlaneIndex < numSectionPlanes; sectionPlaneIndex++) {
//                     const sectionPlaneUniforms = this.#uSectionPlanes[sectionPlaneIndex];
//                     if (sectionPlaneUniforms) {
//                         const active = occlusionLayer.sectionPlanesActive[sectionPlaneIndex];
//                         gl.uniform1i(sectionPlaneUniforms.active, active ? 1 : 0);
//                         if (active) {
//                             const sectionPlane = sectionPlanes[sectionPlaneIndex];
//                             gl.uniform3fv(sectionPlaneUniforms.pos, getPlaneRTCPos(sectionPlane.dist, sectionPlane.dir, origin, tempVec3a));
//                             gl.uniform3fv(sectionPlaneUniforms.dir, sectionPlane.dir);
//                         }
//                     }
//                 }
//             }
//
//             this._aPosition.bindArrayBuffer(occlusionLayer.positionsBuf);
//
//             const indicesBuf = occlusionLayer.indicesBuf;
//             indicesBuf.bind();
//             gl.drawElements(gl.POINTS, indicesBuf.numItems, indicesBuf.itemType, 0);
//         }
//     }
//
//     /**
//      * Sets visibilities of {@link Marker}s according to whether or not they are obscured by anything in the render buffer.
//      */
//     doOcclusionTest() {
//
//         if (!TEST_MODE) {
//
//             const resolutionScale = this.#scene.canvas.resolutionScale;
//
//             const markerR = MARKER_COLOR[0] * 255;
//             const markerG = MARKER_COLOR[1] * 255;
//             const markerB = MARKER_COLOR[2] * 255;
//
//             for (let i = 0, len = this._occlusionLayersList.length; i < len; i++) {
//
//                 const occlusionLayer = this._occlusionLayersList[i];
//
//                 for (let i = 0; i < occlusionLayer.lenOcclusionTestList; i++) {
//
//                     const marker = occlusionLayer.occlusionTestList[i];
//                     const j = i * 2;
//                     const color = this._readPixelBuf.read(Math.round(occlusionLayer.pixels[j] * resolutionScale), Math.round(occlusionLayer.pixels[j + 1] * resolutionScale));
//                     const visible = (color[0] === markerR) && (color[1] === markerG) && (color[2] === markerB);
//
//                     marker._setVisible(visible);
//                 }
//             }
//         }
//     }
//
//     /**
//      * Unbinds render buffer.
//      */
//     unbindRenderBuf() {
//         if (!TEST_MODE) {
//             this._readPixelBuf.unbind();
//         }
//     }
//
//     /**
//      * Destroys this OcclusionTester.
//      */
//     destroy() {
//         if (this.destroyed) {
//             return;
//         }
//         for (let i = 0, len = this._occlusionLayersList.length; i < len; i++) {
//             const occlusionLayer = this._occlusionLayersList[i];
//             occlusionLayer.destroy();
//         }
//
//         if (this.#program) {
//             this.#program.destroy();
//         }
//
//         this.#scene.camera.off(this._onCameraViewMatrix);
//         this.#scene.camera.off(this._onCameraProjMatrix);
//         this.#scene.canvas.off(this._onViewBoundary);
//         this.destroyed = true;
//     }
// }
//
// export {OcclusionTester};
