import * as math from "../../math";
import {ModelMesh} from "./ModelMesh";

class Model extends Component {

    /**
     * Returns true to indicate that this Component is a Model.
     * @type {Boolean}
     */
    get isModel() {
        return true;
    }

    constructor(model, cfg) {

        super(model, cfg);

        this._maxGeometryBatchSize = cfg.maxGeometryBatchSize;

        this.#aabb = math.collapseAABB3();
        this._aabbDirty = false;
        this._layerList = []; // For GL state efficiency when drawing, InstancingLayers are in first part, BatchingLayers are in second
        this._nodeList = [];

        this._lastRTCCenter = null;
        this._lastDecodeMatrix = null;
        this._lastNormals = null;

        this._instancingLayers = {};
        this._currentBatchingLayers = {};

        this._scratchMemory = getScratchMemory();

        this._meshes = {};
        this._objects = {};

        /** @private **/
        this.renderFlags = new RenderFlags();

        /**
         * @private
         */
        this.numGeometries = 0; // Number of instance-able geometries created with createGeometry()

        // These counts are used to avoid unnecessary render passes
        // They are incremented or decremented exclusively by BatchingLayer and InstancingLayer
        /**
         * @private
         */
        this.numPortions = 0;

        /**
         * @private
         */
        this.numVisibleLayerPortions = 0;

        /**
         * @private
         */
        this.numTransparentLayerPortions = 0;

        /**
         * @private
         */
        this.numXRayedLayerPortions = 0;

        /**
         * @private
         */
        this.numHighlightedLayerPortions = 0;

        /**
         * @private
         */
        this.numSelectedLayerPortions = 0;

        /**
         * @private
         */
        this.numEdgesLayerPortions = 0;

        /**
         * @private
         */
        this.numPickableLayerPortions = 0;

        /**
         * @private
         */
        this.numClippableLayerPortions = 0;

        /**
         * @private
         */
        this.numCulledLayerPortions = 0;

        /** @private */
        this.numEntities = 0;

        /** @private */
        this._numTriangles = 0;

        /** @private */
        this._numLines = 0;

        /** @private */
        this._numPoints = 0;

        this._edgeThreshold = cfg.edgeThreshold || 10;

        // Build static matrix

        this._position = new Float64Array(cfg.position || [0, 0, 0]);
        this._rotation = new Float64Array(cfg.rotation || [0, 0, 0]);
        this._quaternion = new Float64Array(cfg.quaternion || [0, 0, 0, 1]);
        if (cfg.rotation) {
            math.eulerToQuaternion(this._rotation, "XYZ", this._quaternion);
        }
        this._scale = new Float64Array(cfg.scale || [1, 1, 1]);
        this._worldMatrix = math.mat4();
        math.composeMat4(this._position, this._quaternion, this._scale, this._worldMatrix);
        this._worldNormalMatrix = math.mat4();
        math.inverseMat4(this._worldMatrix, this._worldNormalMatrix);
        math.transposeMat4(this._worldNormalMatrix);
    }

    /**
     * Gets the Model's local translation.
     *
     * Default value is ````[0,0,0]````.
     *
     * @type {Number[]}
     */
    get position() {
        return this._position;
    }

    /**
     * Gets the Model's local rotation, as Euler angles given in degrees, for each of the X, Y and Z axis.
     *
     * Default value is ````[0,0,0]````.
     *
     * @type {Number[]}
     */
    get rotation() {
        return this._rotation;
    }

    /**
     * Gets the Models's local rotation quaternion.
     *
     * Default value is ````[0,0,0,1]````.
     *
     * @type {Number[]}
     */
    get quaternion() {
        return this._quaternion;
    }

    /**
     * Gets the Model's local scale.
     *
     * Default value is ````[1,1,1]````.
     *
     * @type {Number[]}
     */
    get scale() {
        return this._scale;
    }

    /**
     * Gets the Model's local modeling transform matrix.
     *
     * Default value is ````[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]````.
     *
     * @type {Number[]}
     */
    get matrix() {
        return this._worldMatrix;
    }

    /**
     * Gets the Model's World matrix.
     *
     * @property worldMatrix
     * @type {Number[]}
     */
    get worldMatrix() {
        return this._worldMatrix;
    }

    /**
     * Gets the Model's World normal matrix.
     *
     * @type {Number[]}
     */
    get worldNormalMatrix() {
        return this._worldNormalMatrix;
    }

    /**
     * Creates a reusable geometry within this Model.
     *
     * We can then supply the geometry ID to {@link Model#createMesh} when we want to create meshes that instance the geometry.
     *
     * If provide a  ````positionsDecodeMatrix```` , then ````createGeometry()```` will assume
     * that the ````positions```` and ````normals```` arrays are compressed. When compressed, ````positions```` will be
     * quantized and in World-space, and ````normals```` will be oct-encoded and in World-space.
     *
     * Note that ````positions````, ````normals```` and ````indices```` are all required together.
     *
     * @param cfg Geometry properties.
     * @param {String|Number} cfg.id Mandatory ID for the geometry, to refer to with {@link Model#createMesh}.
     * @param cfg.primitive The primitive type. Accepted values are 'points', 'lines', 'triangles', 'solid' and 'surface'.
     * @param cfg.positions Flat array of positions.
     * @param [cfg.normals] Flat array of normal vectors. Only used with 'triangles' primitives. When no normals are given, the geometry will be flat shaded using auto-generated face-aligned normals.
     * @param [cfg.colors] Flat array of RGBA vertex colors as float values in range ````[0..1]````. Ignored when ````geometryId```` is given, overidden by ````color```` and ````colorsCompressed````.
     * @param [cfg.colorsCompressed] Flat array of RGBA vertex colors as unsigned short integers in range ````[0..255]````. Ignored when ````geometryId```` is given, overrides ````colors```` and is overriden by ````color````.
     * @param [cfg.indices] Array of indices. Not required for `points` primitives.
     * @param [cfg.edgeIndices] Array of edge line indices. Used only for Required for 'triangles' primitives. These are automatically generated internally if not supplied, using the ````edgeThreshold```` given to the ````Model```` constructor.
     * @param [cfg.positionsDecodeMatrix] A 4x4 matrix for decompressing ````positions````.
     * @param [cfg.rtcCenter] Relative-to-center (RTC) coordinate system center. When this is given, then ````positions```` are assumed to be relative to this center.
     */
    createGeometry(cfg) {
        if (!instancedArraysSupported) {
            this.error("WebGL instanced arrays not supported"); // TODO: Gracefully use batching?
            return;
        }
        const geometryId = cfg.id;
        if (geometryId === undefined || geometryId === null) {
            this.error("Config missing: id");
            return;
        }
        if (this._instancingLayers[geometryId]) {
            this.error("Geometry already created: " + geometryId);
            return;
        }
        let instancingLayer;
        const primitive = cfg.primitive;
        if (primitive === undefined || primitive === null) {
            this.error("Config missing: primitive");
            return;
        }
        switch (primitive) {
            case "triangles":
                instancingLayer = new TrianglesInstancingLayer(this, utils.apply({
                    layerIndex: 0,
                    solid: true
                }, cfg));
                this._numTriangles += (cfg.indices ? Math.round(cfg.indices.length / 3) : 0);
                break;
            case "solid":
                instancingLayer = new TrianglesInstancingLayer(this, utils.apply({
                    layerIndex: 0,
                    solid: true
                }, cfg));
                this._numTriangles += (cfg.indices ? Math.round(cfg.indices.length / 3) : 0);
                break;
            case "surface":
                instancingLayer = new TrianglesInstancingLayer(this, utils.apply({
                    layerIndex: 0,
                    solid: false
                }, cfg));
                this._numTriangles += (cfg.indices ? Math.round(cfg.indices.length / 3) : 0);
                break;
            case "lines":
                instancingLayer = new LinesInstancingLayer(this, utils.apply({
                    layerIndex: 0
                }, cfg));
                this._numLines += (cfg.indices ? Math.round(cfg.indices.length / 2) : 0);
                break;
            case "points":
                instancingLayer = new PointsInstancingLayer(this, utils.apply({
                    layerIndex: 0
                }, cfg));
                this._numPoints += (cfg.positions ? Math.round(cfg.positions.length / 3) : 0);
                break;
        }
        this._instancingLayers[geometryId] = instancingLayer;
        this._layerList.push(instancingLayer);
        this.numGeometries++;
    }

    /**
     * Creates a mesh within this Model.
     *
     * A mesh can either share geometry with other meshes, or have its own unique geometry.
     *
     * To share a geometry with other meshes, provide the ID of a geometry created earlier
     * with {@link Model#createGeometry}.
     *
     * To create unique geometry for the mesh, provide geometry data arrays.
     *
     * Internally, Model will batch all unique mesh geometries into the same arrays, which improves
     * rendering performance.
     *
     * If you accompany the arrays with a  ````positionsDecodeMatrix```` , then ````createMesh()```` will assume
     * that the ````positions```` and ````normals```` arrays are compressed. When compressed, ````positions```` will be
     * quantized and in World-space, and ````normals```` will be oct-encoded and in World-space.
     *
     * If you accompany the arrays with an  ````rtcCenter````, then ````createMesh()```` will assume
     * that the ````positions```` are in relative-to-center (RTC) coordinates, with ````rtcCenter```` being the origin of their
     * RTC coordinate system.
     *
     * When providing either ````positionsDecodeMatrix```` or ````rtcCenter````, ````createMesh()```` will start a new
     * batch each time either of those two parameters change since the last call. Therefore, to combine arrays into the
     * minimum number of batches, it's best for performance to create your shared meshes in runs that have the same value
     * for ````positionsDecodeMatrix```` and ````rtcCenter````.
     *
     * Note that ````positions````, ````normals```` and ````indices```` are all required together.
     *
     * @param {object} cfg Object properties.
     * @param cfg.id Mandatory ID for the new mesh. Must not clash with any existing components within the {@link Scene}.
     * @param {String|Number} [cfg.geometryId] ID of a geometry to instance, previously created with {@link Model#createGeometry:method"}}createMesh(){{/crossLink}}. Overrides all other geometry parameters given to this method.
     * @param [cfg.primitive="triangles"]  Geometry primitive type. Ignored when ````geometryId```` is given. Accepted values are 'points', 'lines' and 'triangles'.
     * @param [cfg.positions] Flat array of vertex positions. Ignored when ````geometryId```` is given.
     * @param [cfg.colors] Flat array of RGB vertex colors as float values in range ````[0..1]````. Ignored when ````geometryId```` is given, overriden by ````color```` and ````colorsCompressed````.
     * @param [cfg.colorsCompressed] Flat array of RGB vertex colors as unsigned short integers in range ````[0..255]````. Ignored when ````geometryId```` is given, overrides ````colors```` and is overriden by ````color````.
     * @param [cfg.normals] Flat array of normal vectors. Only used with 'triangles' primitives. When no normals are given, the mesh will be flat shaded using auto-generated face-aligned normals.
     * @param [cfg.positionsDecodeMatrix] A 4x4 matrix for decompressing ````positions````.
     * @param [cfg.rtcCenter] Relative-to-center (RTC) coordinate system center. When this is given, then ````positions```` are assumed to be relative to this center.
     * @param [cfg.indices] Array of triangle indices. Ignored when ````geometryId```` is given.
     * @param [cfg.edgeIndices] Array of edge line indices. If ````geometryId```` is not given, edge line indices are
     * automatically generated internally if not given, using the ````edgeThreshold```` given to the ````Model````
     * constructor. This parameter is ignored when ````geometryId```` is given.
     * @param [cfg.position=[0,0,0]] Local 3D position. of the mesh
     * @param [cfg.scale=[1,1,1]] Scale of the mesh.
     * @param [cfg.rotation=[0,0,0]] Rotation of the mesh as Euler angles given in degrees, for each of the X, Y and Z axis.
     * @param [cfg.matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]] Mesh modelling transform matrix. Overrides the ````position````, ````scale```` and ````rotation```` parameters.
     * @param [cfg.color=[1,1,1]] RGB color in range ````[0..1, 0..`, 0..1]````. Overrides ````colors```` and ````colorsCompressed````.
     * @param [cfg.opacity=1] Opacity in range ````[0..1]````.
     */
    createMesh(cfg) {

        let id = cfg.id;
        if (id === undefined || id === null) {
            this.error("Config missing: id");
            return;
        }
        if (this._meshes[id]) {
            this.error("Model already has a Mesh with this ID: " + id + "");
            return;
        }

        const geometryId = cfg.geometryId;
        const instancing = (geometryId !== undefined);

        if (instancing) {
            if (!this._instancingLayers[geometryId]) {
                this.error("Geometry not found: " + geometryId + " - ensure that you create it first with createGeometry()");
                return;
            }
        }

        let layer;
        let portionId;

        const color = (cfg.color) ? new Uint8Array([Math.floor(cfg.color[0] * 255), Math.floor(cfg.color[1] * 255), Math.floor(cfg.color[2] * 255)]) : [255, 255, 255];
        const opacity = (cfg.opacity !== undefined && cfg.opacity !== null) ? Math.floor(cfg.opacity * 255) : 255;
        const metallic = (cfg.metallic !== undefined && cfg.metallic !== null) ? Math.floor(cfg.metallic * 255) : 0;
        const roughness = (cfg.roughness !== undefined && cfg.roughness !== null) ? Math.floor(cfg.roughness * 255) : 255;

        const mesh = new ModelMesh(this, id, color, opacity);

        const pickId = mesh.pickId;

        const a = pickId >> 24 & 0xFF;
        const b = pickId >> 16 & 0xFF;
        const g = pickId >> 8 & 0xFF;
        const r = pickId & 0xFF;

        const pickColor = new Uint8Array([r, g, b, a]); // Quantized pick color

        const aabb = math.collapseAABB3();

        if (instancing) {

            let meshMatrix;
            let worldMatrix = this._worldMatrixNonIdentity ? this._worldMatrix : null;

            if (cfg.matrix) {
                meshMatrix = cfg.matrix;
            } else {
                const scale = cfg.scale || defaultScale;
                const position = cfg.position || defaultPosition;
                const rotation = cfg.rotation || defaultRotation;
                math.eulerToQuaternion(rotation, "XYZ", defaultQuaternion);
                meshMatrix = math.composeMat4(position, defaultQuaternion, scale, tempMat4);
            }

            const instancingLayer = this._instancingLayers[geometryId];

            layer = instancingLayer;

            portionId = instancingLayer.createPortion({
                color: color,
                metallic: metallic,
                roughness: roughness,
                opacity: opacity,
                meshMatrix: meshMatrix,
                worldMatrix: worldMatrix,
                aabb: aabb,
                pickColor: pickColor
            });

            math.expandAABB3(this.#aabb, aabb);

            const numTriangles = Math.round(instancingLayer.numIndices / 3);
            this._numTriangles += numTriangles;
            mesh.numTriangles = numTriangles;

            mesh.rtcCenter = instancingLayer.rtcCenter;

        } else { // Batching

            let primitive = cfg.primitive || "triangles";

            if (primitive !== "points" && primitive !== "lines" && primitive !== "triangles" && primitive !== "solid" && primitive !== "surface") {
                this.error(`Unsupported value for 'primitive': '${primitive}' - supported values are 'points', 'lines', 'triangles', 'solid' and 'surface'. Defaulting to 'triangles'.`);
                primitive = "triangles";
            }

            let positions = cfg.positions;

            if (!positions) {
                this.error("Config missing: positions (no meshIds provided, so expecting geometry arrays instead)");
                return null;
            }

            let indices = cfg.indices;
            let edgeIndices = cfg.edgeIndices;

            if (!cfg.indices && primitive === "triangles") {
                this.error("Config missing for triangles primitive: indices (no meshIds provided, so expecting geometry arrays instead)");
                return null;
            }

            let needNewBatchingLayers = false;

            if (cfg.rtcCenter) {
                if (!this._lastRTCCenter) {
                    needNewBatchingLayers = true;
                    this._lastRTCCenter = math.vec3(cfg.rtcCenter);
                } else {
                    if (!math.compareVec3(this._lastRTCCenter, cfg.rtcCenter)) {
                        needNewBatchingLayers = true;
                        this._lastRTCCenter.set(cfg.rtcCenter);
                    }
                }
            }

            if (cfg.positionsDecodeMatrix) {
                if (!this._lastDecodeMatrix) {
                    needNewBatchingLayers = true;
                    this._lastDecodeMatrix = math.mat4(cfg.positionsDecodeMatrix);

                } else {
                    if (!math.compareMat4(this._lastDecodeMatrix, cfg.positionsDecodeMatrix)) {
                        needNewBatchingLayers = true;
                        this._lastDecodeMatrix.set(cfg.positionsDecodeMatrix)
                    }
                }
            }

            if (needNewBatchingLayers) {
                for (let prim in this._currentBatchingLayers) {
                    if (this._currentBatchingLayers.hasOwnProperty(prim)) {
                        this._currentBatchingLayers[prim].finalize();
                    }
                }
                this._currentBatchingLayers = {};
            }

            const normalsProvided = (!!cfg.normals && cfg.normals.length > 0);

            if (primitive === "triangles" || primitive === "solid" || primitive === "surface") {
                if (this._lastNormals !== null && normalsProvided !== this._lastNormals) {
                    ["triangles", "solid", "surface"].map(primitiveId => {
                        if (this._currentBatchingLayers[primitiveId]) {
                            this._currentBatchingLayers[primitiveId].finalize();
                            delete this._currentBatchingLayers[primitiveId];
                        }
                    });
                }
                this._lastNormals = normalsProvided;
            }

            const worldMatrix = this._worldMatrixNonIdentity ? this._worldMatrix : null;
            let meshMatrix;

            if (!cfg.positionsDecodeMatrix) {
                if (cfg.matrix) {
                    meshMatrix = cfg.matrix;
                } else {
                    const scale = cfg.scale || defaultScale;
                    const position = cfg.position || defaultPosition;
                    const rotation = cfg.rotation || defaultRotation;
                    math.eulerToQuaternion(rotation, "XYZ", defaultQuaternion);
                    meshMatrix = math.composeMat4(position, defaultQuaternion, scale, tempMat4);
                }
            }

            layer = this._currentBatchingLayers[primitive];

            switch (primitive) {

                case "triangles":
                case "solid":
                case "surface":

                    if (layer) {
                        if (!layer.canCreatePortion(positions.length, indices.length)) {
                            layer.finalize();
                            delete this._currentBatchingLayers[primitive];
                            layer = null;
                        }
                    }

                    if (!layer) {
                        layer = new TrianglesBatchingLayer(this, {
                            layerIndex: 0, // This is set in #finalize()
                            scratchMemory: this._scratchMemory,
                            positionsDecodeMatrix: cfg.positionsDecodeMatrix,  // Can be undefined
                            rtcCenter: cfg.rtcCenter, // Can be undefined
                            maxGeometryBatchSize: this._maxGeometryBatchSize,
                            solid: (primitive === "solid"),
                            autoNormals: (!normalsProvided)
                        });
                        this._layerList.push(layer);
                        this._currentBatchingLayers[primitive] = layer;
                    }

                    if (!edgeIndices) {
                        edgeIndices = buildEdgeIndices(positions, indices, null, this._edgeThreshold);
                    }

                    portionId = layer.createPortion({
                        positions: positions,
                        normals: cfg.normals,
                        indices: indices,
                        edgeIndices: edgeIndices,
                        color: color,
                        metallic: metallic,
                        roughness: roughness,
                        colors: cfg.colors,
                        colorsCompressed: cfg.colorsCompressed,
                        opacity: opacity,
                        meshMatrix: meshMatrix,
                        worldMatrix: worldMatrix,
                        worldAABB: aabb,
                        pickColor: pickColor
                    });

                    const numTriangles = Math.round(indices.length / 3);
                    this._numTriangles += numTriangles;
                    mesh.numTriangles = numTriangles;

                    break;

                case "lines":

                    if (layer) {
                        if (!layer.canCreatePortion(positions.length, indices.length)) {
                            layer.finalize();
                            delete this._currentBatchingLayers[primitive];
                            layer = null;
                        }
                    }

                    if (!layer) {
                        layer = new LinesBatchingLayer(this, {
                            layerIndex: 0, // This is set in #finalize()
                            scratchMemory: this._scratchMemory,
                            positionsDecodeMatrix: cfg.positionsDecodeMatrix,  // Can be undefined
                            rtcCenter: cfg.rtcCenter, // Can be undefined
                            maxGeometryBatchSize: this._maxGeometryBatchSize
                        });
                        this._layerList.push(layer);
                        this._currentBatchingLayers[primitive] = layer;
                    }

                    portionId = layer.createPortion({
                        positions: positions,
                        indices: indices,
                        color: color,
                        colors: cfg.colors,
                        colorsCompressed: cfg.colorsCompressed,
                        opacity: opacity,
                        meshMatrix: meshMatrix,
                        worldMatrix: worldMatrix,
                        worldAABB: aabb,
                        pickColor: pickColor
                    });

                    this._numLines += Math.round(indices.length / 2);

                    break;

                case "points":

                    if (layer) {
                        if (!layer.canCreatePortion(positions.length)) {
                            layer.finalize();
                            delete this._currentBatchingLayers[primitive];
                            layer = null;
                        }
                    }

                    if (!layer) {
                        layer = new PointsBatchingLayer(this, {
                            layerIndex: 0, // This is set in #finalize()
                            scratchMemory: this._scratchMemory,
                            positionsDecodeMatrix: cfg.positionsDecodeMatrix,  // Can be undefined
                            rtcCenter: cfg.rtcCenter, // Can be undefined
                            maxGeometryBatchSize: this._maxGeometryBatchSize
                        });
                        this._layerList.push(layer);
                        this._currentBatchingLayers[primitive] = layer;
                    }

                    portionId = layer.createPortion({
                        positions: positions,
                        color: color,
                        colors: cfg.colors,
                        colorsCompressed: cfg.colorsCompressed,
                        opacity: opacity,
                        meshMatrix: meshMatrix,
                        worldMatrix: worldMatrix,
                        worldAABB: aabb,
                        pickColor: pickColor
                    });

                    this._numPoints += Math.round(positions.length / 3);

                    break;
            }

            math.expandAABB3(this.#aabb, aabb);

            this.numGeometries++;

            mesh.rtcCenter = cfg.rtcCenter;
        }

        mesh.parent = null; // Will be set within ModelNode constructor
        mesh._layer = layer;
        mesh._portionId = portionId;
        mesh.aabb = aabb;

        this._meshes[id] = mesh;
    }

}