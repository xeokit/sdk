import {
    createVec2,
    createVec3,
    cross3Vec3,
    dotVec3,
    lenVec3,
    mulVec3Scalar,
    normalizeVec3,
    subVec3
} from "@xeokit/matrix";
import {SceneModel} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";
// @ts-ignore
import {earcut} from './earcut';
import {TrianglesPrimitive} from "@xeokit/constants";
import {BasicAggregation} from "@xeokit/basictypes";
import {typeCodes} from "@xeokit/cityjsontypes_1_1_3";
import {isJSONObject} from "@xeokit/utils";

const tempVec2a = createVec2();
const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();

/**
 * Loads CityJSON into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/cityjson" | @xeokit/cityjson} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - CityJSON file data.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - CityJSON loading options
 * @param options.rotateX - True to rotate the model about the X-axis. Default is false.
 * @returns {Promise} Resolves when CityJSON has been loaded into the SceneModel and/or DataModel.
 * @throws *{@link @xeokit/core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export function loadCityJSON(params: {
                                 fileData: any,
                                 sceneModel?: SceneModel,
                                 dataModel?: DataModel
                             },
                             options: {
                                 rotateX?: boolean;
                             } = {
                                 rotateX: false
                             }): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (!params) {
            return reject("Argument expected: params");
        }
        const {fileData, sceneModel, dataModel} = params;
        if (!fileData) {
            return reject("Argument expected: params.fileData");
        }
        if (!isJSONObject(fileData)) {
            return reject("Argument type mismatch: params.fileData should be a JSON object");
        }
        if (sceneModel) {
            if (!(sceneModel instanceof SceneModel)) {
                return reject("Argument type mismatch: params.sceneModel should be a SceneModel");
            }
            if (sceneModel.destroyed) {
                return reject("SceneModel already destroyed");
            }
            if (sceneModel.built) {
                return reject("SceneModel already built");
            }
        }
        if (dataModel) {
            if (!(dataModel instanceof DataModel)) {
                return reject("Argument type mismatch: params.dataModel should be a DataModel");
            }
            if (dataModel.destroyed) {
                return reject("DataModel already destroyed");
            }
            if (dataModel.built) {
                return reject("DataModel already built");
            }
        }
        if (sceneModel || dataModel) {
            const ctx = {
                fileData,
                vertices: (fileData.transform && params.sceneModel)
                    ? transformVertices(fileData.vertices, fileData.transform, options.rotateX)
                    : fileData.vertices,
                sceneModel,
                dataModel,
                nextId: 0
            };
            parseCityJSON(ctx);
        }
        return resolve();
    });
}

function transformVertices(vertices: any, transform: any, rotateX?: boolean) {
    const transformedVertices = [];
    const scale = transform.scale || createVec3([1, 1, 1]);
    const translate = transform.translate || createVec3([0, 0, 0]);
    for (let i = 0, j = 0; i < vertices.length; i++, j += 3) {
        const x = (vertices[i][0] * scale[0]) + translate[0];
        const y = (vertices[i][1] * scale[1]) + translate[1];
        const z = (vertices[i][2] * scale[2]) + translate[2];
        if (rotateX) {
            transformedVertices.push([x, z, y]);
        } else {
            transformedVertices.push([x, y, z]);
        }
    }
    return transformedVertices;
}

function parseCityJSON(ctx: any) {
    const fileData = ctx.fileData;
    const cityObjects = fileData.CityObjects;
    for (const objectId in cityObjects) {
        parseCityObject(ctx, cityObjects[objectId], objectId);
    }
    if (ctx.dataModel) {
        for (const objectId in cityObjects) {
            parseRelationship(ctx, cityObjects[objectId], objectId);
        }
    }
}

function parseCityObject(ctx: any, cityObject: any, objectId: any) {
    if (ctx.dataModel) {
        ctx.dataModel.createObject({
            id: objectId,
            name: cityObject.type + " : " + objectId,
            type: typeCodes[cityObject.type] | 0,
            parent: cityObject.parents ? cityObject.parents[0] : null
        });
    }
    if (ctx.sceneModel) {
        if (!(cityObject.geometry && cityObject.geometry.length > 0)) {
            return;
        }
        const meshIds: string | any[] = [];
        for (let i = 0, len = cityObject.geometry.length; i < len; i++) {
            const geometry = cityObject.geometry[i];
            let objectMaterial;
            let surfaceMaterials;
            const appearance = ctx.fileData.appearance;
            if (appearance) {
                const materials = appearance.materials;
                if (materials) {
                    const geometryMaterial = geometry.material;
                    if (geometryMaterial) {
                        const themeIds = Object.keys(geometryMaterial);
                        if (themeIds.length > 0) {
                            const themeId = themeIds[0];
                            const theme = geometryMaterial[themeId];
                            if (theme.value !== undefined) {
                                objectMaterial = materials[theme.value];
                            } else {
                                const values = theme.values;
                                if (values) {
                                    surfaceMaterials = [];
                                    for (let j = 0, lenj = values.length; j < lenj; j++) {
                                        const value = values[i];
                                        const surfaceMaterial = materials[value];
                                        surfaceMaterials.push(surfaceMaterial);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (surfaceMaterials) {
                parseGeometrySurfacesWithOwnMaterials(ctx, geometry, surfaceMaterials, meshIds);
            } else {
                parseGeometrySurfacesWithSharedMaterial(ctx, geometry, objectMaterial, meshIds);
            }
        }
        if (meshIds.length > 0) {
            ctx.sceneModel.createObject({
                id: objectId,
                meshIds: meshIds
            });
        }
    }
}

function parseRelationship(ctx: any, cityObject: any, objectId: any) {
    if (cityObject.parents) {
        ctx.dataModel.createRelationship({
            relatingObjectId: cityObject.parents[0],
            relatedObjectId: objectId,
            type: BasicAggregation
        });
    }
}

function parseGeometrySurfacesWithOwnMaterials(ctx: any, geometry: any, surfaceMaterials: any, meshIds: any) {
    const geomType = geometry.type;
    switch (geomType) {
        case "MultiPoint":
            break;
        case "MultiLineString":
            break;
        case "MultiSurface":
        case "CompositeSurface":
            const surfaces = geometry.boundaries;
            parseSurfacesWithOwnMaterials(ctx, surfaceMaterials, surfaces, meshIds);
            break;
        case "Solid":
            const shells = geometry.boundaries;
            for (let j = 0; j < shells.length; j++) {
                const surfaces = shells[j];
                parseSurfacesWithOwnMaterials(ctx, surfaceMaterials, surfaces, meshIds);
            }
            break;
        case "MultiSolid":
        case "CompositeSolid":
            const solids = geometry.boundaries;
            for (let j = 0; j < solids.length; j++) {
                for (let k = 0; k < solids[j].length; k++) {
                    const surfaces = solids[j][k];
                    parseSurfacesWithOwnMaterials(ctx, surfaceMaterials, surfaces, meshIds);
                }
            }
            break;
        case "GeometryInstance":
            break;
    }
}

function parseSurfacesWithOwnMaterials(ctx: any, surfaceMaterials: any, surfaces: any, meshIds: any) {
    const vertices = ctx.vertices;
    const sceneModel = ctx.sceneModel;
    for (let i = 0; i < surfaces.length; i++) {
        const surface = surfaces[i];
        const surfaceMaterial = surfaceMaterials[i] || {diffuseColor: [0.8, 0.8, 0.8], transparency: 1.0};
        const face = [];
        const holes = [];
        const sharedIndices: any[] = [];
        const geometryCfg: any = {
            positions: [],
            indices: []
        };
        for (let j = 0; j < surface.length; j++) {
            if (face.length > 0) {
                holes.push(face.length);
            }
            const newFace = extractLocalIndices(ctx, surface[j], sharedIndices, geometryCfg);
            face.push(...newFace);
        }
        if (face.length === 3) { // Triangle
            geometryCfg.indices.push(face[0]);
            geometryCfg.indices.push(face[1]);
            geometryCfg.indices.push(face[2]);
        } else if (face.length > 3) { // Polygon
            // Prepare to triangulate
            const pList = [];
            for (let k = 0; k < face.length; k++) {
                pList.push({
                    x: vertices[sharedIndices[face[k]]][0],
                    y: vertices[sharedIndices[face[k]]][1],
                    z: vertices[sharedIndices[face[k]]][2]
                });
            }
            const normal = getNormalOfPositions(pList, createVec3());
            // Convert to 2D
            let pv = [];
            for (let k = 0; k < pList.length; k++) {
                to2D(pList[k], normal, tempVec2a);
                pv.unshift(tempVec2a[0]);
                pv.unshift(tempVec2a[1]);
            }
            // Triangulate
            const tr = earcut(pv, holes, 2);
            // Create triangles
            for (let k = 0; k < tr.length; k += 3) {
                geometryCfg.indices.unshift(face[tr[k]]);
                geometryCfg.indices.unshift(face[tr[k + 1]]);
                geometryCfg.indices.unshift(face[tr[k + 2]]);
            }
        }
        const geometryId = "" + ctx.nextId++;
        sceneModel.createGeometry({
            id: geometryId,
            primitive: TrianglesPrimitive,
            positions: geometryCfg.positions,
            indices: geometryCfg.indices
        });
        const meshId = "" + ctx.nextId++;
        sceneModel.createMesh({
            id: meshId,
            geometryId,
            color: (surfaceMaterial && surfaceMaterial.diffuseColor) ? surfaceMaterial.diffuseColor : [0.8, 0.8, 0.8],
            opacity: (surfaceMaterial && surfaceMaterial.transparency !== undefined) ? (1.0 - surfaceMaterial.transparency) : 1.0
        });
        meshIds.push(meshId);
    }
}

function parseGeometrySurfacesWithSharedMaterial(ctx: any, geometry: any, objectMaterial: any, meshIds: any) {
    const sceneModel = ctx.sceneModel;
    const sharedIndices: any = [];
    const geometryCfg: any = {
        positions: [],
        indices: []
    };
    const geomType = geometry.type;
    switch (geomType) {
        case "MultiPoint":
            break;
        case "MultiLineString":
            break;
        case "MultiSurface":
        case "CompositeSurface":
            const surfaces = geometry.boundaries;
            parseSurfacesWithSharedMaterial(ctx, surfaces, sharedIndices, geometryCfg);
            break;
        case "Solid":
            const shells = geometry.boundaries;
            for (let j = 0; j < shells.length; j++) {
                const surfaces = shells[j];
                parseSurfacesWithSharedMaterial(ctx, surfaces, sharedIndices, geometryCfg);
            }
            break;
        case "MultiSolid":
        case "CompositeSolid":
            const solids = geometry.boundaries;
            for (let j = 0; j < solids.length; j++) {
                for (let k = 0; k < solids[j].length; k++) {
                    const surfaces = solids[j][k];
                    parseSurfacesWithSharedMaterial(ctx, surfaces, sharedIndices, geometryCfg);
                }
            }
            break;
        case "GeometryInstance":
            break;
    }
    if (geometryCfg.positions.length > 0 && geometryCfg.indices.length > 0) {
        const geometryId = "" + ctx.nextId++;
        sceneModel.createGeometry({
            id: geometryId,
            primitive: TrianglesPrimitive,
            positions: geometryCfg.positions,
            indices: geometryCfg.indices
        });
        const meshId = "" + ctx.nextId++;
        sceneModel.createMesh({
            id: meshId,
            geometryId,
            color: (objectMaterial && objectMaterial.diffuseColor) ? objectMaterial.diffuseColor : [0.8, 0.8, 0.8],
            opacity: 1.0
        });
        meshIds.push(meshId);
    }
}

function parseSurfacesWithSharedMaterial(ctx: any, surfaces: any, sharedIndices: any, primitiveCfg: any) {
    const vertices = ctx.vertices;
    for (let i = 0; i < surfaces.length; i++) {
        let boundary = [];
        let holes = [];
        for (let j = 0; j < surfaces[i].length; j++) {
            if (boundary.length > 0) {
                holes.push(boundary.length);
            }
            const newBoundary = extractLocalIndices(ctx, surfaces[i][j], sharedIndices, primitiveCfg);
            boundary.push(...newBoundary);
        }
        if (boundary.length === 3) { // Triangle
            primitiveCfg.indices.push(boundary[0]);
            primitiveCfg.indices.push(boundary[1]);
            primitiveCfg.indices.push(boundary[2]);
        } else if (boundary.length > 3) { // Polygon
            let pList = [];
            for (let k = 0; k < boundary.length; k++) {
                pList.push({
                    x: vertices[sharedIndices[boundary[k]]][0],
                    y: vertices[sharedIndices[boundary[k]]][1],
                    z: vertices[sharedIndices[boundary[k]]][2]
                });
            }
            const normal = getNormalOfPositions(pList, createVec3());
            let pv = [];
            for (let k = 0; k < pList.length; k++) {
                to2D(pList[k], normal, tempVec2a);
                pv.unshift(tempVec2a[0]);
                pv.unshift(tempVec2a[1]);
            }
            const tr = earcut(pv, holes, 2);
            for (let k = 0; k < tr.length; k += 3) {
                primitiveCfg.indices.unshift(boundary[tr[k]]);
                primitiveCfg.indices.unshift(boundary[tr[k + 1]]);
                primitiveCfg.indices.unshift(boundary[tr[k + 2]]);
            }
        }
    }
}

function extractLocalIndices(ctx: any, boundary: any, sharedIndices: any, geometryCfg: any) {
    const vertices = ctx.vertices;
    const newBoundary = []
    for (let i = 0, len = boundary.length; i < len; i++) {
        const index = boundary[i];
        if (sharedIndices.includes(index)) {
            const vertexIndex = sharedIndices.indexOf(index);
            newBoundary.push(vertexIndex);
        } else {
            geometryCfg.positions.push(vertices[index][0]);
            geometryCfg.positions.push(vertices[index][1]);
            geometryCfg.positions.push(vertices[index][2]);
            newBoundary.push(sharedIndices.length);
            sharedIndices.push(index);
        }
    }
    return newBoundary
}

function getNormalOfPositions(positions: any, normal: any) {
    for (let i = 0; i < positions.length; i++) {
        let nexti = i + 1;
        if (nexti === positions.length) {
            nexti = 0;
        }
        normal[0] += ((positions[i].y - positions[nexti].y) * (positions[i].z + positions[nexti].z));
        normal[1] += ((positions[i].z - positions[nexti].z) * (positions[i].x + positions[nexti].x));
        normal[2] += ((positions[i].x - positions[nexti].x) * (positions[i].y + positions[nexti].y));
    }
    return normalizeVec3(normal);
}

function to2D(_p: any, _n: any, re: any) {
    const p = tempVec3a;
    const n = tempVec3b;
    const x3 = tempVec3c;
    p[0] = _p.x;
    p[1] = _p.y;
    p[2] = _p.z;
    n[0] = _n.x;
    n[1] = _n.y;
    n[2] = _n.z;
    x3[0] = 1.1;
    x3[1] = 1.1;
    x3[2] = 1.1;
    const dist = lenVec3(subVec3(x3, n));
    if (dist < 0.01) {
        x3[0] += 1.0;
        x3[1] += 2.0;
        x3[2] += 3.0;
    }
    const dot = dotVec3(x3, n);
    const tmp2 = mulVec3Scalar(n, dot, createVec3());
    x3[0] -= tmp2[0];
    x3[1] -= tmp2[1];
    x3[2] -= tmp2[2];
    normalizeVec3(x3);
    const y3 = cross3Vec3(n, x3, createVec3());
    const x = dotVec3(p, x3);
    const y = dotVec3(p, y3);
    re[0] = x;
    re[1] = y;
}
