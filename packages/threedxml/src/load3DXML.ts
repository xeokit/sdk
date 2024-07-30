import {createVec2, createVec3, mat3ToMat4} from "@xeokit/matrix";
import type {SceneModel} from "@xeokit/scene";
import type {DataModel} from "@xeokit/data";
// @ts-ignore
import {earcut} from './earcut';
// import {TrianglesPrimitive} from "@xeokit/constants";
// import {BasicAggregation} from "@xeokit/basictypes";
// import {typeCodes} from "@xeokit/threedxmltypes_1_1_3";
import {SDKError} from "@xeokit/core";
import {ZIP} from "./ZIP";
import {TrianglesPrimitive} from "@xeokit/constants";
import {BasicEntity} from "@xeokit/basictypes";

const supportedSchemas: any = {
    "4.2": true,
    "4.3": true
};

const tempVec2a = createVec2();
const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();

/**
 * @private
 */
type _3DXMLParsingContext = {
    viewpoint: any;
    materials: any;
    zip: ZIP;
    nextId: number;
    dataModel?: DataModel;
    sceneModel: SceneModel;
    info: {
        references: {}
    },
    log: (msg: string) => void,
    error: (errMsg: string) => void
}

/**
 * Loads 3DXML into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/threedxml"} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - 3DXML file data.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param params.log - Logging callback.
 * @param params.error - Error logging callback.
 * @returns {Promise} Resolves when 3DXML has been loaded into the SceneModel and/or DataModel.
 * @throws *{@link @xeokit/core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 * * If the DataModel has already been built.
 */
export function load3DXML(params: {
    fileData: Blob,
    sceneModel: SceneModel,
    dataModel?: DataModel,
    log?: (msg: string) => void,
    error?: (errMsg: string) => void
}): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (params.sceneModel.destroyed) {
            throw new SDKError("SceneModel already destroyed");
        }
        if (params.sceneModel.built) {
            throw new SDKError("SceneModel already built");
        }
        if (params.dataModel) {
            if (params.dataModel.destroyed) {
                throw new SDKError("DataModel already destroyed");
            }
            if (params.dataModel.built) {
                throw new SDKError("DataModel already built");
            }
        }
        const zip = new ZIP();
        zip.loadFileData(params.fileData)
            .then(() => {
                const ctx: _3DXMLParsingContext = {
                    zip,
                    viewpoint: {},
                    materials: {},
                    sceneModel: params.sceneModel,
                    dataModel: params.dataModel,
                    nextId: 0,
                    info: {
                        references: {}
                    },
                    log: (msg: string) => {

                    },
                    error: (msg: string) => {

                    }
                };
                parseDocument(ctx,
                    () => {
                        zip.destroy();
                        resolve();
                    },
                    (errMsg: string) => {
                        zip.destroy();
                        reject(new SDKError(`Error parsing 3DXML: ${errMsg}`));
                    });
            })
            .catch((errMsg: string) => {
                zip.destroy();
                throw new SDKError(`Failed to parse ZIP: ${errMsg}`);
            });
    });
}

function parseDocument(ctx: _3DXMLParsingContext, ok: () => void, err: (arg0: string) => void) {
    ctx.zip.getFile("Manifest.xml",
        (json: any) => {
            const children = json.children;
            for (let i = 0, len = children.length; i < len; i++) {
                const child = children[i];
                switch (child.type) {
                    case "Manifest":
                        parseManifest(ctx, child, ok, err);
                        break;
                }
            }
        },
        err);
}

function parseManifest(ctx: _3DXMLParsingContext, node: any, ok: () => void, err: (arg0: string) => void) {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "Root":
                let rootFileSrc = child.children[0];
                ctx.zip.getFile(rootFileSrc,
                    (rootFileNode: any) => {
                        parseRoot(ctx, rootFileNode, ok);
                    },
                    err);
                break;
        }
    }
}

function parseRoot(ctx: _3DXMLParsingContext, node: any, ok: () => void) {
    let children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        let child = children[i];
        switch (child.type) {
            case "Model_3dxml":
                parseModel(ctx, child, ok);
                break;
        }
    }
}

function parseModel(ctx: _3DXMLParsingContext, node: any, ok: () => void) {
    let children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        let child = children[i];
        switch (child.type) {
            case "Header":
                parseHeader(ctx, child);
                break;
            case "ProductStructure":
                ok();
                parseProductStructure(ctx, child, ok);
                break;
            case "DefaultView":
                parseDefaultView(ctx, child);
                break;
        }
    }
}

function parseHeader(ctx: _3DXMLParsingContext, node: any) {
    const children = node.children;
    const metaData: any = {};
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "SchemaVersion":
                metaData.schemaVersion = child.children[0];
                if (!supportedSchemas[metaData.schemaVersion]) {
                    ctx.error("Schema version not supported: " + metaData.schemaVersion + " - supported versions are: " + Object.keys(supportedSchemas).join(","));
                } else {
                    ctx.log("Parsing schema version: " + metaData.schemaVersion);
                }
                break;
            case "Title":
                metaData.title = child.children[0];
                break;
            case "Author":
                metaData.author = child.children[0];
                break;
            case "Created":
                metaData.created = child.children[0];
                break;
        }
    }

}


function parseProductStructure(ctx: _3DXMLParsingContext, productStructureNode, ok) {

    parseReferenceReps(ctx, productStructureNode, (referenceReps) => {

        // Parse out an intermediate scene DAG representation, that we can then
        // recursive descend through to build a xeokit Object hierarchy.

        const children = productStructureNode.children;

        const reference3Ds: any = {};
        const instanceReps: any = {};
        const instance3Ds: any = {};

        let rootNode;
        const nodes = {};

        // Map all the elements

        for (let i = 0, len = children.length; i < len; i++) {
            const child = children[i];
            switch (child.type) {
                case "Reference3D":
                    reference3Ds[child.id] = {
                        type: "Reference3D",
                        id: child.id,
                        name: child.name,
                        instance3Ds: {},
                        instanceReps: {}
                    };
                    break;
                case "InstanceRep": {
                    let isAggregatedBy = null;
                    let isInstanceOf = null;
                    for (let j = 0, lenj = child.children.length; j < lenj; j++) {
                        const child2 = child.children[j];
                        switch (child2.type) {
                            case "IsAggregatedBy":
                                isAggregatedBy = child2.children[0];
                                break;
                            case "IsInstanceOf":
                                isInstanceOf = child2.children[0];
                                break;
                        }
                    }
                    instanceReps[child.id] = {
                        type: "InstanceRep",
                        id: child.id,
                        name: child.name,
                        isAggregatedBy,
                        isInstanceOf,
                        referenceReps: {}
                    };
                    break;
                }
                case "Instance3D": {
                    let isAggregatedBy = null;
                    let isInstanceOf = null;
                    let relativeMatrix = null;
                    for (let j = 0, lenj = child.children.length; j < lenj; j++) {
                        const child2 = child.children[j];
                        switch (child2.type) {
                            case "IsAggregatedBy":
                                isAggregatedBy = child2.children[0];
                                break;
                            case "IsInstanceOf":
                                isInstanceOf = child2.children[0];
                                break;
                            case "RelativeMatrix":
                                relativeMatrix = child2.children[0];
                                break;
                        }
                    }
                    instance3Ds[child.id] = {
                        type: "Instance3D",
                        id: child.id,
                        name: child.name,
                        isAggregatedBy,
                        isInstanceOf,
                        relativeMatrix,
                        reference3Ds: {}
                    };
                    break;
                }
            }
        }

        // Connect Reference3Ds to the Instance3Ds they aggregate

        for (let id in instance3Ds) {
            const instance3D = instance3Ds[id];
            const reference3D = reference3Ds[instance3D.isAggregatedBy];
            if (reference3D) {
                reference3D.instance3Ds[instance3D.id] = instance3D;
            }
        }

        // Connect Instance3Ds to the Reference3Ds they instantiate

        for (let id in instance3Ds) {
            const instance3D = instance3Ds[id];
            let reference3D = reference3Ds[instance3D.isInstanceOf];
            instance3D.reference3Ds[reference3D.id] = reference3D;
            reference3D.instance3D = instance3D;
        }

        // Connect InstanceReps to the ReferenceReps they instantiate

        for (let id in instanceReps) {
            let instanceRep = instanceReps[id];
            let referenceRep = referenceReps[instanceRep.isInstanceOf];
            if (referenceRep) {
                instanceRep.referenceReps[referenceRep.id] = referenceRep;
            }
        }

        // Connect Reference3Ds to the InstanceReps they aggregate

        for (let id in instanceReps) {
            let instanceRep = instanceReps[id];
            let reference3D = reference3Ds[instanceRep.isAggregatedBy];
            if (reference3D) {
                reference3D.instanceReps[instanceRep.id] = instanceRep;
            }
        }

        // Find the root Reference3D

        for (let id in reference3Ds) {
            const reference3D = reference3Ds[id];
            if (!reference3D.instance3D) {
                parseReference3D(ctx, reference3D, null); // HACK: Assuming that root has id == "1"
                ok();
                return;
            }
        }

        //       alert("No root Reference3D element found in this modelNode - can't load.");

        ok();
    });
}

function parseReference3D(ctx: _3DXMLParsingContext, reference3D: any, group: any) {
    for (let id in reference3D.instance3Ds) {
        parseInstance3D(ctx, reference3D.instance3Ds[id], group);
    }
    for (let id in reference3D.instanceReps) {
        parseInstanceRep(ctx, reference3D.instanceReps[id], group);
    }
}

function parseInstance3D(ctx: _3DXMLParsingContext, instance3D: any, group: any) {
    //ctx.plugin.log("parseInstance3D( " + instance3D.id + " )");

    // if (instance3D.relativeMatrix) {
    //     const matrix = parseFloatArray(instance3D.relativeMatrix, 12);
    //     const translate = [matrix[9], matrix[10], matrix[11]];
    //     const mat3 = matrix.slice(0, 9); // Rotation matrix
    //     const mat4 = mat3ToMat4(mat3);
    //     const childGroup = new Node(ctx.modelNode, {
    //         position: translate
    //     });
    //     if (ctx.metaModelData) {
    //         ctx.metaModelData.metaObjects.push({
    //             id: childGroup.id,
    //             type: "Default",
    //             name: instance3D.name,
    //             parent: group ? group.id : ctx.modelNode.id
    //         });
    //     }
    //     if (group) {
    //         group.addChild(childGroup, true);
    //     } else {
    //         ctx.modelNode.addChild(childGroup, true);
    //     }
    //     group = childGroup;
    //     childGroup = new Node(ctx.modelNode, {
    //         matrix: mat4
    //     });
    //     if (ctx.metaModelData) {
    //         ctx.metaModelData.metaObjects.push({
    //             id: childGroup.id,
    //             type: "Default",
    //             name: instance3D.name,
    //             parent: group ? group.id : ctx.modelNode.id
    //         });
    //     }
    //     group.addChild(childGroup, true);
    //     group = childGroup;
    // } else {
    //     const childGroup = new Node(ctx.modelNode, {});
    //     if (ctx.metaModelData) {
    //         ctx.metaModelData.metaObjects.push({
    //             id: childGroup.id,
    //             type: "Default",
    //             name: instance3D.name,
    //             parent: group ? group.id : ctx.modelNode.id
    //         });
    //     }
    //     if (group) {
    //         group.addChild(childGroup, true);
    //     } else {
    //         ctx.modelNode.addChild(childGroup, true);
    //     }
    //     group = childGroup;
    // }
    // for (let id in instance3D.reference3Ds) {
    //     parseReference3D(ctx, instance3D.reference3Ds[id], group);
    // }
}

function parseInstanceRep(ctx: _3DXMLParsingContext, instanceRep: any, group: any) {
    if (instanceRep.referenceReps) {
        for (let id in instanceRep.referenceReps) {
            const referenceRep = instanceRep.referenceReps[id];
            for (let id2 in referenceRep) {
                if (id2 === "id") {
                    continue; // HACK
                }
                const meshCfg = referenceRep[id2];
                const mesh = ctx.sceneModel.createMesh({
                    id: `mesh-${ctx.nextId}`,
                    geometryId: meshCfg.geometryId,
                    color: meshCfg.color
                });
                if (mesh instanceof SDKError) {

                } else {
                    const sceneObject = ctx.sceneModel.createObject({
                        id: `object-${ctx.nextId}`,
                        meshIds: [mesh.id]
                    });
                    if (sceneObject instanceof SDKError) {

                    } else {
                        if (ctx.dataModel) {
                            ctx.dataModel.createObject({
                                id: mesh.id,
                                type: BasicEntity,
                                name: instanceRep.name
                                // ,
                                // parent: group ? group.id : ctx.modelNode.id
                            });
                        }
                        if (group) {
                            //   group.addChild(mesh, true);
                        }
                    }
                }
            }
        }
    }
}

export function parseDefaultView(ctx: _3DXMLParsingContext, node: any) {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "Viewpoint":
                const children2 = child.children;
                ctx.viewpoint = {};
                for (let i2 = 0, len2 = children2.length; i2 < len2; i2++) {
                    const child2 = children2[i];
                    switch (child2.type) {
                        case "Position":
                            ctx.viewpoint.eye = parseFloatArray(child2.children[0], 3);
                            break;
                        case "Sight":
                            ctx.viewpoint.look = parseFloatArray(child2.children[0], 3);
                            break;
                        case "Up":
                            ctx.viewpoint.up = parseFloatArray(child2.children[0], 3);
                            break;
                    }
                }
                break;
            case "DefaultViewProperty":
                break;
        }
    }
}

function parseReferenceReps(ctx: _3DXMLParsingContext, node: any, ok: (any) => void) {
    const referenceReps = {};
    const children = node.children;
    let numToLoad = 0;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        if (child.type === "ReferenceRep") {
            numToLoad++;
        }
    }
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "ReferenceRep":
                if (child.associatedFile) {
                    const src = stripURN(child.associatedFile);
                    (function () {
                        const childId = child.id;
                        ctx.zip.getFile(src,
                            (json, xmlDoc) => {
                                const materialIds = xmlDoc.getElementsByTagName("MaterialId");
                                loadCATMaterialRefDocuments(ctx, materialIds, () => {
                                    const referenceRep = {
                                        id: childId
                                    };
                                    parse3DRepDocument(ctx, json, referenceRep);
                                    referenceReps[childId] = referenceRep;
                                    if (--numToLoad === 0) {
                                        ok(referenceReps);
                                    }
                                });
                            },
                            (error: string) => {
                                // TODO:
                            });
                    })();
                }
                break;
        }
    }
}

function parse3DRepDocument(ctx: _3DXMLParsingContext, node: any, result: any) {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "XMLRepresentation":
                parseXMLRepresentation(ctx, child, result);
                break;
        }
    }
}

function parseXMLRepresentation(ctx: _3DXMLParsingContext, node: any, result: any) {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "Root":
                parse3DRepRoot(ctx, child, result);
                break;
        }
    }
}

function parse3DRepRoot(ctx: _3DXMLParsingContext, node: any, result: any) {
    switch (node["xsi:type"]) {
        case "BagRepType":
            break;
        case "PolygonalRepType":
            break;
    }
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "Rep":
                parse3DRepRep(ctx, child, result);
                break;
        }
    }
}

function parse3DRepRep(ctx: _3DXMLParsingContext, node: any, result: any) {
    switch (node["xsi:type"]) {
        case "BagRepType":
            break;
        case "PolygonalRepType":
            break;
    }
    const geometryParams: any = {
        id: `geometry-${ctx.nextId++}`,
        primitive: TrianglesPrimitive
    };
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "Rep":
                parse3DRepRep(ctx, child, result);
                break;
            case "Edges":
                // Ignoring edges because we auto-generate our own using xeokit
                break;
            case "Faces":
                geometryParams.primitive = TrianglesPrimitive;
                parseFaces(ctx, child, geometryParams);
                break;
            case "VertexBuffer":
                parseVertexBuffer(ctx, child, geometryParams);
                break;
            case "SurfaceAttributes":
                parseSurfaceAttributes(ctx, child, geometryParams);
                break;
        }
    }
    if (geometryParams.positions) {
        ctx.sceneModel.createGeometry(geometryParams);
        result[geometryParams.id] = {
            geometry: geometryParams,
            color: geometryParams.color || [1.0, 1.0, 1.0, 1.0],
            materialId: geometryParams.materialId
        };
    }
}


function parseEdges(ctx: _3DXMLParsingContext, node: any, geometryParams: any) {
    geometryParams.positions = [];
    geometryParams.indices = [];
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "Polyline":
                parsePolyline(ctx, child, geometryParams);
                break;
        }
    }
}

function parsePolyline(ctx: _3DXMLParsingContext, node: any, geometryParams: any) {
    const vertices = node.vertices;
    if (vertices) {
        const positions = parseFloatArray(vertices, 3);
        if (positions.length > 0) {
            const positionsOffset = geometryParams.positions.length / 3;
            for (let i = 0, len = positions.length; i < len; i++) {
                geometryParams.positions.push(positions[i]);
            }
            for (let i = 0, len = (positions.length / 3) - 1; i < len; i++) {
                geometryParams.indices.push(positionsOffset + i);
                geometryParams.indices.push(positionsOffset + i + 1);
            }
        }
    }
}

function parseFaces(ctx: _3DXMLParsingContext, node: any, geometryParams: any) {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "Face":
                parseFace(ctx, child, geometryParams);
                break;
        }
    }
}

function parseFace(ctx: _3DXMLParsingContext, node: any, geometryParams: any) {
    const strips = node.strips;
    if (strips) {
        const arrays = parseIntArrays(strips);
        if (arrays.length > 0) {
            geometryParams.primitive = TrianglesPrimitive;
            const indices = [];
            for (let i = 0, len = arrays.length; i < len; i++) {
                const array = convertTriangleStrip(arrays[i]);
                for (let j = 0, lenj = array.length; j < lenj; j++) {
                    indices.push(array[j]);
                }
            }
            geometryParams.indices = indices; // TODO
        }
    } else {
        const triangles = node.triangles;
        if (triangles) {
            geometryParams.primitive = TrianglesPrimitive;
            geometryParams.indices = parseIntArray(triangles);
        }
    }
    // Material
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "SurfaceAttributes":
                parseSurfaceAttributes(ctx, child, geometryParams);
                break;
        }
    }
}

function convertTriangleStrip(indices: Int16Array): number[] {
    const ccw = false;
    const indices2 = [];
    for (let i = 0, len = indices.length; i < len - 2; i++) {
        if (ccw) {
            if (i & 1) { //
                indices2.push(indices[i]);
                indices2.push(indices[i + 1]);
                indices2.push(indices[i + 2]);
            } else {
                indices2.push(indices[i]);
                indices2.push(indices[i + 2]);
                indices2.push(indices[i + 1]);
            }
        } else {
            if (i & 1) { //
                indices2.push(indices[i]);
                indices2.push(indices[i + 2]);
                indices2.push(indices[i + 1]);
            } else {
                indices2.push(indices[i]);
                indices2.push(indices[i + 1]);
                indices2.push(indices[i + 2]);
            }
        }
    }
    return indices2;
}

function parseVertexBuffer(ctx: _3DXMLParsingContext, node: any, result: any) {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "Positions":
                result.positions = parseFloatArray(child.children[0], 3);
                break;
            case "Normals":
                result.normals = parseFloatArray(child.children[0], 3);
                break;
            case "TextureCoordinates": // TODO: Support dimension and channel?
                result.uv = parseFloatArray(child.children[0], 2);
                break;
        }
    }
}

function parseIntArrays(str: string): Int16Array[] {
    const coordStrings = str.split(",");
    const array = [];
    for (let i = 0, len = coordStrings.length; i < len; i++) {
        const coordStr = coordStrings[i].trim();
        if (coordStr.length > 0) {
            const elemStrings = coordStr.trim().split(" ");
            const arr = new Int16Array(elemStrings.length);
            let arrIdx = 0;
            for (let j = 0, lenj = elemStrings.length; j < lenj; j++) {
                if (elemStrings[j] !== "") {
                    arr[arrIdx++] = parseInt(elemStrings[j]);
                }
            }
            array.push(arr);
        }
    }
    return array;
}

function parseFloatArray(str: string, numElems: number): Float32Array {
    const coordStrings = str.split(",");
    const arr = new Float32Array(coordStrings.length * numElems);
    let arrIdx = 0;
    for (let i = 0, len = coordStrings.length; i < len; i++) {
        const value = coordStrings[i];
        const elemStrings = value.split(" ");
        for (let j = 0, lenj = elemStrings.length; j < lenj; j++) {
            if (elemStrings[j] !== "") {
                arr[arrIdx++] = parseFloat(elemStrings[j]);
            }
        }
    }
    return arr;
}

function parseIntArray(str: string): Int32Array {
    const coordStrings = str.trim().split(" ");
    const arr = new Int32Array(coordStrings.length);
    let arrIdx = 0;
    for (let i = 0, len = coordStrings.length; i < len; i++) {
        const value = coordStrings[i];
        arr[i] = parseInt(value);
    }
    return arr;
}

function parseSurfaceAttributes(ctx: _3DXMLParsingContext, node: any, result: any) {
    result.color = [1, 1, 1, 1];
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "Color":
                result.color[0] = child.red;
                result.color[1] = child.green;
                result.color[2] = child.blue;
                result.color[3] = child.alpha;
                break;
            case "MaterialApplication":
                const children2 = child.children;
                for (let j = 0, lenj = children2.length; j < lenj; j++) {
                    const child2 = children2[j];
                    switch (child2.type) {
                        case "MaterialId":
                            const materialId = getIDFromURI(child2.id);
                            const material = ctx.materials[materialId];
                            if (!material) {
                                //      ctx.plugin.error("material  not found: " + materialId);
                            }
                            result.materialId = materialId;
                            break;
                    }
                }
                break;
        }
    }
}

function loadCATMaterialRefDocuments(ctx: _3DXMLParsingContext, materialIds: any, ok: any) {

    const loaded: any = {};

    function load(i: number, done: any) {
        if (i >= materialIds.length) {
            ok();
            return;
        }
        let materialId = materialIds[i];
        let src = materialId.id;
        let colonIdx = src.lastIndexOf(":");
        if (colonIdx > 0) {
            src = src.substring(colonIdx + 1);
        }
        let hashIdx = src.lastIndexOf("#");
        if (hashIdx > 0) {
            src = src.substring(0, hashIdx);
        }
        if (!loaded[src]) {
            loadCATMaterialRefDocument(ctx, src, () => {
                    loaded[src] = true;
                    load(i + 1, done);
                },
                (errMsg: string) => {
                });
        } else {
            load(i + 1, done);
        }
    }

    load(0, ok);
}

function loadCATMaterialRefDocument(ctx: _3DXMLParsingContext, src: string, ok: () => void, err: (errMsg: string) => void) { // Loads CATMaterialRef.3dxml
    ctx.zip.getFile(src, (json) => {
        parseCATMaterialRefDocument(ctx, json, ok);
    }, err);
}

function parseCATMaterialRefDocument(ctx: _3DXMLParsingContext, node: any, ok: () => void) { // Parse CATMaterialRef.3dxml
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        if (child.type === "Model_3dxml") {
            parseModel_3dxml(ctx, child, ok);
        }
    }
}

function parseModel_3dxml(ctx: _3DXMLParsingContext, node: any, ok: () => void) { // Parse CATMaterialRef.3dxml
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        if (child.type === "CATMaterialRef") {
            parseCATMaterialRef(ctx, child, ok);
        }
    }
}

function parseCATMaterialRef(ctx: _3DXMLParsingContext, node: any, ok: () => void) {
    const domainToReferenceMap = {};
    const children = node.children;
    let numToLoad = 0;
    for (let j = 0, lenj = children.length; j < lenj; j++) {
        const child2 = children[j];
        switch (child2.type) {
            case "MaterialDomainInstance":
                let isAggregatedBy = 0;
                let isInstanceOf = 0;
                for (let k = 0, lenk = child2.children.length; k < lenk; k++) {
                    const child3 = child2.children[k];
                    switch (child3.type) {
                        case "IsAggregatedBy":
                            isAggregatedBy = child3.children[0];
                            break;
                        case "IsInstanceOf":
                            isInstanceOf = child3.children[0];
                            break;
                    }
                }
                domainToReferenceMap[isInstanceOf] = isAggregatedBy;
                break;
        }
    }
    for (let j = 0, lenj = children.length; j < lenj; j++) {
        const child2 = children[j];
        switch (child2.type) {
            case "MaterialDomain":
                numToLoad++;
                break;
        }
    }
    for (let j = 0, lenj = children.length; j < lenj; j++) {
        const child2 = children[j];
        switch (child2.type) {
            case "MaterialDomain":
                if (child2.associatedFile) {
                    (function () {
                        const childId = child2.id;
                        const src = stripURN(child2.associatedFile);
                        ctx.zip.getFile(src, (json) => {
                                ctx.materials[domainToReferenceMap[childId]] = parseMaterialDefDocument(ctx, json);
                                if (--numToLoad === 0) {
                                    ok();
                                }
                            },
                            function (error) {
                                // TODO:
                            });
                    })();
                }
                break;
        }
    }
}

function parseMaterialDefDocument(ctx: _3DXMLParsingContext, node: any): any {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child: any = children[i];
        switch (child.type) {
            case "Osm":
                return parseMaterialDefDocumentOsm(ctx, child);
        }
    }
}

function parseMaterialDefDocumentOsm(ctx: _3DXMLParsingContext, node: any): any {
    const children = node.children;
    for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        switch (child.type) {
            case "RenderingRootFeature":
                //..
                break;
            case "Feature":
                if (child.Alias === "RenderingFeature") {
                    const coeffs: any = {};
                    const materialCfg: any = {};
                    const children2 = child.children;
                    for (let j = 0, lenj = children2.length; j < lenj; j++) {
                        const child2 = children2[j];
                        switch (child2.Name) {
                            case "AmbientCoef":
                                coeffs.ambient = parseFloat(child2.Value);
                                break;
                            case "DiffuseCoef":
                                coeffs.diffuse = parseFloat(child2.Value);
                                break;
                            case "EmissiveCoef":
                                coeffs.emissive = parseFloat(child2.Value);
                                break;
                            case "SpecularExponent":
                                coeffs.specular = parseFloat(child2.Value);
                                break;
                        }
                    }
                    for (let j = 0, lenj = children2.length; j < lenj; j++) {
                        const child2 = children2[j];
                        switch (child2.Name) {
                            case "AmbientColor":
                                materialCfg.ambient = parseRGB(child2.Value, coeffs.ambient);
                                break;
                            case "DiffuseColor":
                                materialCfg.diffuse = parseRGB(child2.Value, coeffs.diffuse);
                                break;
                            case "EmissiveColor":
                                materialCfg.emissive = parseRGB(child2.Value, coeffs.emissive);
                                break;
                            case "SpecularColor":
                                materialCfg.specular = parseRGB(child2.Value, coeffs.specular);
                                break;
                            case "Transparency":
                                const alpha = 1.0 - parseFloat(child2.Value); // Degree of transparency, not opacity
                                if (alpha < 1.0) {
                                    materialCfg.alpha = alpha;
                                    materialCfg.alphaMode = "blend";
                                }
                                break;
                        }
                    }
                    const material: any = {
                        reflectivity: 0.5,
                        ambient: materialCfg.ambient,
                        diffuse: materialCfg.diffuse,
                        specular: materialCfg.specular,
                        // shininess: node.shine,
                        emissive: materialCfg.emissive,
                        alphaMode: materialCfg.alphaMode,
                        alpha: node.alpha
                    };
                    return material;
                }
                break;
        }
    }
}

function parseRGB(str: string, coeff: number): Float32Array {
    coeff = (coeff !== undefined) ? coeff : 0.5;
    const openBracketIndex = str.indexOf("[");
    const closeBracketIndex = str.indexOf("]");
    const subStr = str.substring(openBracketIndex + 1, closeBracketIndex - openBracketIndex);
    const strParts = subStr.split(",");
    const arr = new Float32Array(subStr.length);
    let arrIdx = 0;
    for (let i = 0, len = strParts.length; i < len; i++) {
        const value = strParts[i];
        const valueParts = value.trim().split(" ");
        for (let j = 0, lenj = valueParts.length; j < lenj; j++) {
            if (valueParts[j] !== "") {
                arr[arrIdx++] = parseFloat(valueParts[j]) * coeff;
            }
        }
    }
    return arr;
}

function stripURN(str: string): string {
    const subStr = "urn:3DXML:";
    return (str.indexOf(subStr) === 0) ? str.substring(subStr.length) : str;
}

function getIDFromURI(str: string): string {
    const hashIdx = str.lastIndexOf("#");
    return hashIdx !== -1 ? str.substring(hashIdx + 1) : str;
}

