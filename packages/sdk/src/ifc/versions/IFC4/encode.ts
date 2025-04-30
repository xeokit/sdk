import {SceneMesh, SceneObject, SceneModel} from "../../../scene";
import {createUUID} from "../../../utils";
import {DataModel, DataObject, PropertySet, Relationship} from "../../../data";
import {ifcTypeNames} from "../../../ifctypes";
import {ModelEncodeParams} from "../../../io";

/** @private
 */
export function encode(params: ModelEncodeParams, options?: any): Promise<any> {
    return new Promise<any>(function (resolve, reject) {
        resolve(generateIFC(params.sceneModel, params.dataModel));
    });
}

interface IFCHeader {
    fileSchema: string;
    fileDescription: string[];
    fileName: string;
    timeStamp: string;
    author: string[];
    organization: string[];
    preprocessorVersion: string;
    originatingSystem: string;
    authorization: string;
}

function generateIFC(sceneModel: SceneModel, dataModel: DataModel, header?: Partial<IFCHeader>): string {

    const defaultHeader: IFCHeader = {
        fileSchema: 'IFC4',
        fileDescription: ['ViewDefinition [CoordinationView]'],
        fileName: sceneModel.id,
        timeStamp: new Date().toISOString(),
        author: dataModel.author ? [dataModel.author] : ['xeokit SDK'],
        organization: ['xeokit'],
        preprocessorVersion: 'xeokit SDK',
        originatingSystem: dataModel.creatingApplication || 'xeokit SDK',
        authorization: 'None'
    };

    const finalHeader = { ...defaultHeader, ...header };
    const ifcContent = [];

    generateIFCHeader(finalHeader, ifcContent);

    ifcContent.push(`DATA;`);

    const projectId = generateGUID();
    ifcContent.push(`#1=${generateOwnerHistory()}`);
    ifcContent.push(`#2=IFCPROJECT('${projectId}',#1,'${dataModel.projectId || sceneModel.id}',$,$,$,$,(#3),#4);`);
    ifcContent.push(`#3=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#5,$);`);
    ifcContent.push(`#4=IFCUNITASSIGNMENT((#6,#7,#8));`);
    ifcContent.push(`#5=IFCAXIS2PLACEMENT3D(#9,$,$);`);
    ifcContent.push(`#6=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);`);
    ifcContent.push(`#7=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);`);
    ifcContent.push(`#8=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);`);
    ifcContent.push(`#9=IFCCARTESIANPOINT((0.,0.,0.));`);

    let currentId = 10;

    // Process property sets first
    const propertySetMap = new Map<string, number>();
    for (const propertySetId in dataModel.propertySets) {
        const propertySet = dataModel.propertySets[propertySetId];
        const ifcId = currentId;
        propertySetMap.set(propertySetId, ifcId);
        currentId = encodePropertySet(propertySet, ifcContent, currentId);
    }
    for (const objectId in sceneModel.objects) {
        const sceneObject = sceneModel.objects[objectId];
        const dataObject = dataModel.objects[sceneObject.id];
        if (dataObject) {
            currentId = encodeSceneObjectAndDataObject(sceneObject, dataObject, propertySetMap, ifcContent, currentId);
        } else {
            currentId = encodeSceneObject(sceneObject, ifcContent, currentId);
        }
    }
    for (const relationship of dataModel.relationships) {
        currentId = encodeRelationship(relationship, ifcContent, currentId);
    }
    ifcContent.push('ENDSEC;\n\nEND-ISO-10303-21;\n');
    return ifcContent.join("\n");
}

function encodePropertySet(propertySet: PropertySet, ifcContent: string[], currentId: number): number {
    const propertySetId = generateGUID();
    ifcContent.push(`#${currentId}=IFCPROPERTYSET('${propertySetId}',#1,'${propertySet.name}',$,(`);
    const propertyIds: number[] = [];
    currentId++;
    for (const property of propertySet.properties) {
        propertyIds.push(currentId);
        let ifcValue = property.value;
        if (typeof property.value === 'string') {
            ifcValue = `'${property.value}'`;
        }
        ifcContent.push(`#${currentId}=IFCSIMPLEPROPERTY('${property.name}',${property.type || '$'},'${property.description || '$'}',${ifcValue});`);
        currentId++;
    }
    ifcContent.push(`${propertyIds.map(id => `#${id}`).join(',')}))`);
    return currentId;
}

function encodeSceneObject(object: SceneObject, ifcContent: string[], currentId: number): number {
    const objectId = generateGUID();
    ifcContent.push(`#${currentId}=IFCLOCALPLACEMENT(#5,#${currentId + 1});`);
    currentId++;
    const matrix = object.meshes[0]?.matrix || [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    const position = [matrix[12], matrix[13], matrix[14]];
    ifcContent.push(`#${currentId}=IFCAXIS2PLACEMENT3D(#${currentId + 1},$,$);`);
    currentId++;
    ifcContent.push(`#${currentId}=IFCCARTESIANPOINT((${position[0]},${position[1]},${position[2]}));`);
    currentId++;
    for (const mesh of object.meshes) {
        currentId = encodeSceneMesh(mesh, ifcContent, currentId, objectId);
    }
    return currentId;
}

function encodeSceneObjectAndDataObject(
    sceneObject: SceneObject,
    dataObject: DataObject,
    propertySetMap: Map<string, number>,
    ifcContent: string[],
    currentId: number
): number {
    const objectId = generateGUID();

    // Create placement for the object
    ifcContent.push(`#${currentId}=IFCLOCALPLACEMENT(#5,#${currentId + 1});`);
    currentId++;

    // Create axis placement
    const matrix = sceneObject.meshes[0]?.matrix || [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    const position = [matrix[12], matrix[13], matrix[14]];

    ifcContent.push(`#${currentId}=IFCAXIS2PLACEMENT3D(#${currentId + 1},$,$);`);
    currentId++;

    ifcContent.push(`#${currentId}=IFCCARTESIANPOINT((${position[0]},${position[1]},${position[2]}));`);
    currentId++;

    // Process geometry
    const geometryIds: number[] = [];
    for (const mesh of sceneObject.meshes) {
        const geomStartId = currentId;
        currentId = encodeSceneMesh(mesh, ifcContent, currentId, objectId);
        if (currentId > geomStartId) {
            geometryIds.push(geomStartId);
        }
    }

    // Create IFC object with type from DataObject
    const ifcType = getIFCTypeFromDataObject(dataObject);
    const ifcContent2 = [];
    ifcContent2.push(`#${currentId}=${ifcType}('${objectId}',#1,'${dataObject.name || ''}','${dataObject.description || ''}'`);



    // Add object placement
    ifcContent2.push(`,#${currentId - 3}`); // Reference to IFCLOCALPLACEMENT

    // Add geometric representation
    if (geometryIds.length > 0) {
        ifcContent2.push(`,(${geometryIds.map(id => `#${id}`).join(',')})`);
    } else {
        ifcContent2.push(`,$`);
    }

    // Add property sets
    if (dataObject.propertySets && dataObject.propertySets.length > 0) {
        const psetRefs = dataObject.propertySets
            .map(pset => propertySetMap.get(pset.id))
            .filter(id => id !== undefined)
            .map(id => `#${id}`);
        if (psetRefs.length > 0) {
            ifcContent2.push(`,(${psetRefs.join(',')})`);
        }
    }

    ifcContent2.push(');');
    ifcContent.push(ifcContent2.join());
    currentId++;

    return currentId;
}

function getIFCTypeFromDataObject(dataObject: DataObject): string {
    const ifcTypeName = ifcTypeNames[dataObject.type];
    return ifcTypeName !== undefined ? ifcTypeName.toUpperCase() : 'IFCBUILDINGELEMENTPROXY';
}

function encodeRelationship(relationship: Relationship, ifcContent: string[], currentId: number): number {
    const relationshipId = generateGUID();
    const ifcTypeName = ifcTypeNames[relationship.type];
    const ifcRelType =  ifcTypeName !== undefined ? ifcTypeName.toUpperCase() : 'IFCRELDEFINESBYPROPERTIES';
    ifcContent.push(`#${currentId}=${ifcRelType}('${relationshipId}',#1,$,$,#${relationship.relatingObject.id},#${relationship.relatedObject.id});`);
    currentId++;
    return currentId;
}

function encodeSceneMesh(mesh: SceneMesh, ifcContent: string[], currentId: number, parentId: string): number {
    const geometry = mesh.geometry;

    if (!geometry.positionsCompressed) {
        return currentId;
    }

    const positions = geometry.positionsCompressed;
    const vertexPoints: number[][] = [];
    for (let i = 0; i < positions.length; i += 3) {
        vertexPoints.push([
            positions[i],
            positions[i + 1],
            positions[i + 2]
        ]);
    }

    const indices = geometry.indices;
    const faces: number[][] = [];
    if (indices) {
        for (let i = 0; i < indices.length; i += 3) {
            faces.push([
                indices[i],
                indices[i + 1],
                indices[i + 2]
            ]);
        }
    }

    ifcContent.push(`#${currentId}=IFCSHAPEREPRESENTATION(#3,'Body','Tessellation',(#${currentId + 1}));`);
    currentId++;

    ifcContent.push(`#${currentId}=IFCTRIANGULATEDFACESET(#${currentId + 1},$,#${currentId + 2},.T.);`);
    currentId++;

    let pointList = '';
    for (const point of vertexPoints) {
        pointList += `(${point[0]},${point[1]},${point[2]}),`;
    }
    pointList = pointList.slice(0, -1);

    ifcContent.push(`#${currentId}=IFCCARTESIANPOINTLIST3D((${pointList}));`);
    currentId++;

    let faceList = '';
    for (const face of faces) {
        faceList += `(${face[0] + 1},${face[1] + 1},${face[2] + 1}),`;
    }
    faceList = faceList.slice(0, -1);

    ifcContent.push(`#${currentId}=IFCTRIANGULATEDINDEXLIST((${faceList}));`);
    currentId++;

    return currentId;
}


function generateIFCHeader(header: IFCHeader, ifcContent: string[]) {
    ifcContent.push("ISO-10303-21");
    ifcContent.push("HEADER");
    ifcContent.push(`FILE_DESCRIPTION((${header.fileDescription.map(d => `'${d}'`).join(',')}), '2;1');`);
    ifcContent.push(`FILE_NAME('${header.fileName}','${header.timeStamp}',(${header.author.map(a => `'${a}'`).join(',')}),(${header.organization.map(o => `'${o}'`).join(',')}),'${header.preprocessorVersion}','${header.originatingSystem}','${header.authorization}');`);
    ifcContent.push(`FILE_SCHEMA(('${header.fileSchema}'));`);
    ifcContent.push(`ENDSEC;`);
ifcContent.push(``);
}

function generateGUID(): string {
    return createUUID();
}

function generateOwnerHistory(): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const changeAction = 'ADDED';
    const state = 'READWRITE';
    return `IFCOWNERHISTORY(#100,#101,${timestamp},$,${changeAction},${state},$,$)`;
}
