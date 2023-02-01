import {BuildableModel, ParseParams} from "@xeokit/core/components";
import {createVec3, cross3Vec3, dotVec3, lenVec3, mulVec3Scalar, normalizeVec3, subVec3} from "@xeokit/math/matrix";
import {createUUID} from "@xeokit/core/utils";

interface ParsingContext {
    cityJSON: any;
    nextId: number;
    log: any;
    error: (msg) => void;
    buildableModel: BuildableModel;
    objectCreated: { [key: string]: boolean }
}

/**
 * @desc Parses CityJSON into a {@link BuildableModel}.
 *
 * Use this function with {@link Model} and {@link writeXKT} to convert CityJSON to XKT, or to load CityJSON directly
 * into a {@link Viewer}.
 *
 * ## Usage
 *
 * Parsing CityJSON into an {@link Model}:
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/xkt";
 * import {parseCityJSON} from "@xeokit/cityJSON";
 *
 * const myModel = new ScratchModel(); // Implements BuildableModel and Model
 *
 * utils.loadJSON("../assets/models/cityJSON/HousePlan/cityJSON-Binary/HousePlan.glb", async (data) => {
 *
 *     parseCityJSON({
 *          data,
 *          buildableModel: myModel
 *          log: (msg) => { console.log(msg); }
 *     }).then(()=>{
 *
 *        myModel.build();
 *
 *        const arrayBuffer = writeXKT({
 *            readableModel: myModel
 *        });
 *
 *        // Save arraybuffer
 *     };
 * });
 * ````
 *
 * Loading CityJSON into a {@link Viewer}, by way of a {@link ViewerModel}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {parseCityJSON} from "@xeokit/cityJSON";
 *
 * myViewer = new Viewer({ ... });
 *
 * const myViewerModel = myViewer.createModel(); // Implements BuildableModel
 *
 * utils.loadJSON("../assets/models/cityJSON/HousePlan/cityJSON-Binary/HousePlan.glb", async (data) => {
 *
 *     parseCityJSON({
 *          data,
 *          buildableModel: myViewerModel,
 *          log: (msg) => { console.log(msg); }
 *     }).then(()=>{
 *        myBuildableModel.build();
 *     };
 * });
 * ````
 *
 * @param {ParseParams} params Parsing parameters.
 * @returns {Promise} Resolves when CityJSON has been parsed.
 */
export function parseCityJSON(params: ParseParams): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (!params.data) {
            reject("Argument expected: data");
            return;
        }
        if (!params.buildableModel) {
            reject("Argument expected: buildableModel");
            return;
        }
        resolve();
    });
}


function parseModel(data, params, options, buildableModel) {

    if (buildableModel.destroyed) {
        return;
    }

    const vertices = data.transform ? transformVertices(data.vertices, data.transform, options.rotateX) : data.vertices;

    const stats = params.stats || {};
    stats.sourceFormat = data.type || "CityJSON";
    stats.schemaVersion = data.version || "";
    stats.title = "";
    stats.author = "";
    stats.created = "";
    stats.numMetaObjects = 0;
    stats.numPropertySets = 0;
    stats.numObjects = 0;
    stats.numGeometries = 0;
    stats.numTriangles = 0;
    stats.numVertices = 0;

    const loadMetadata = (params.loadMetadata !== false);

    const rootMetaObject = loadMetadata ? {
        id: createUUID(),
        name: "Model",
        type: "Model"
    } : null;

    const metadata = loadMetadata ? {
        id: "",
        projectId: "",
        author: "",
        createdAt: "",
        schema: data.version || "",
        creatingApplication: "",
        metaObjects: [rootMetaObject],
        propertySets: []
    } : null;

    const ctx = {
        data,
        vertices,
        buildableModel,
        loadMetadata,
        metadata,
        rootMetaObject,
        nextId: 0,
        stats
    };

    parseCityJSON(ctx)

    buildableModel.finalize();

    if (loadMetadata) {
        const metaModelId = buildableModel.id;
        this.viewer.metaScene.createMetaModel(metaModelId, ctx.metadata, options);
    }

    buildableModel.scene.once("tick", () => {
        if (buildableModel.destroyed) {
            return;
        }
        buildableModel.scene.fire("modelLoaded", buildableModel.id); // FIXME: Assumes listeners know order of these two events
        buildableModel.fire("loaded", true, false); // Don't forget the event, for late subscribers
    });
}

function transformVertices(vertices, transform, rotateX) {
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

function parseCityJSON(ctx) {
    const data = ctx.data;
    const cityObjects = data.CityObjects;
    for (const objectId in cityObjects) {
        if (cityObjects.hasOwnProperty(objectId)) {
            const cityObject = cityObjects[objectId];
            parseCityObject(ctx, cityObject, objectId);
        }
    }
}

function parseCityObject(ctx, cityObject, objectId) {

    const buildableModel = ctx.buildableModel;
    const data = ctx.data;

    if (ctx.loadMetadata) {

        const metaObjectId = objectId;
        const metaObjectType = cityObject.type;
        const metaObjectName = metaObjectType + " : " + objectId;
        const parentMetaObjectId = cityObject.parents ? cityObject.parents[0] : ctx.rootMetaObject.id;

        ctx.metadata.metaObjects.push({
            id: metaObjectId,
            name: metaObjectName,
            type: metaObjectType,
            parent: parentMetaObjectId
        });
    }

    ctx.stats.numMetaObjects++;

    if (!(cityObject.geometry && cityObject.geometry.length > 0)) {
        return;
    }

    const meshIds = [];

    for (let i = 0, len = cityObject.geometry.length; i < len; i++) {

        const geometry = cityObject.geometry[i];

        let objectMaterial;
        let surfaceMaterials;

        const appearance = data.appearance;
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
        buildableModel.createEntity({
            id: objectId,
            meshIds: meshIds,
            isObject: true
        });

        ctx.stats.numObjects++;
    }
}

function parseGeometrySurfacesWithOwnMaterials(ctx, geometry, surfaceMaterials, meshIds) {

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

function parseSurfacesWithOwnMaterials(ctx, surfaceMaterials, surfaces, meshIds) {

    const vertices = ctx.vertices;
    const buildableModel = ctx.buildableModel;

    for (let i = 0; i < surfaces.length; i++) {

        const surface = surfaces[i];
        const surfaceMaterial = surfaceMaterials[i] || {diffuseColor: [0.8, 0.8, 0.8], transparency: 1.0};

        const face = [];
        const holes = [];

        const sharedIndices = [];

        const geometryCfg = {
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

        const meshId = "" + ctx.nextId++;

        buildableModel.createMesh({
            id: meshId,
            primitive: "triangles",
            positions: geometryCfg.positions,
            indices: geometryCfg.indices,
            color: (surfaceMaterial && surfaceMaterial.diffuseColor) ? surfaceMaterial.diffuseColor : [0.8, 0.8, 0.8],
            opacity: (surfaceMaterial && surfaceMaterial.transparency !== undefined) ? (1.0 - surfaceMaterial.transparency) : 1.0
        });

        meshIds.push(meshId);

        ctx.stats.numGeometries++;
        ctx.stats.numVertices += geometryCfg.positions.length / 3;
        ctx.stats.numTriangles += geometryCfg.indices.length / 3;
    }
}

function parseGeometrySurfacesWithSharedMaterial(ctx, geometry, objectMaterial, meshIds) {

    const buildableModel = ctx.buildableModel;
    const sharedIndices = [];
    const geometryCfg = {
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

        const meshId = "" + ctx.nextId++;

        buildableModel.createMesh({
            id: meshId,
            primitive: "triangles",
            positions: geometryCfg.positions,
            indices: geometryCfg.indices,
            color: (objectMaterial && objectMaterial.diffuseColor) ? objectMaterial.diffuseColor : [0.8, 0.8, 0.8],
            opacity: 1.0
            //opacity: (objectMaterial && objectMaterial.transparency !== undefined) ? (1.0 - objectMaterial.transparency) : 1.0
        });

        meshIds.push(meshId);

        ctx.stats.numGeometries++;
        ctx.stats.numVertices += geometryCfg.positions.length / 3;
        ctx.stats.numTriangles += geometryCfg.indices.length / 3;
    }
}

function parseSurfacesWithSharedMaterial(ctx, surfaces, sharedIndices, primitiveCfg) {

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

function extractLocalIndices(ctx, boundary, sharedIndices, geometryCfg) {

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

function getNormalOfPositions(positions, normal) {

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

function to2D(_p, _n, re) {

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