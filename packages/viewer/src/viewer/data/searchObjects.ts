import type {SearchParams} from "./SearchParams";
import type {DataObject} from "./DataObject";
import type {Data} from "./Data";

export function searchDataObjects(searchParams: SearchParams, data: Data) {

    const includeObjects = (searchParams.includeObjects && searchParams.includeObjects.length > 0) ? arrayToMap(searchParams.includeObjects) : null;
    const excludeObjects = (searchParams.excludeObjects && searchParams.excludeObjects.length > 0) ? arrayToMap(searchParams.excludeObjects) : null;

    const includeRelating = (searchParams.includeRelating && searchParams.includeRelating.length > 0) ? arrayToMap(searchParams.includeRelating) : null;
    const excludeRelating = (searchParams.excludeRelating && searchParams.excludeRelating.length > 0) ? arrayToMap(searchParams.excludeRelating) : null;

    function visit(dataObject: DataObject) {
        if (!dataObject) {
            return;
        }
        let includeObject = true;
        // @ts-ignore
        if (excludeObjects && excludeObjects[dataObject.type]) {
            includeObject = false;
        } else { // @ts-ignore
            if (includeObjects && (!includeObjects[dataObject.type])) {
                includeObject = false;
            }
        }
        if (includeObject) {
            if (searchParams.resultObjectIds) {
                searchParams.resultObjectIds.push(dataObject.id);
            } else if (searchParams.resultObjects) {
                searchParams.resultObjects.push(dataObject);
            } else if (searchParams.resultCallback) {
                if (searchParams.resultCallback(dataObject)) {
                    return;
                }
            }
        }
        const relations = dataObject.related[searchParams.type];
        if (relations) {
            for (let i = 0, len = relations.length; i < len; i++) {
                let includeRelation = true;
                // @ts-ignore
                if (excludeRelating && excludeRelating[dataObject.type]) {
                    includeRelation = false;
                } else { // @ts-ignore
                    if (includeRelating && (!includeRelating[dataObject.type])) {
                        includeRelation = false;
                    }
                }
                if (includeRelation) {
                    visit(relations[i].related);
                }
            }
        }
    }

    if (searchParams.startObjectId) {
        const startObject = data.objects[searchParams.startObjectId];
        if (startObject) {
            visit(startObject);
        }
    } else if (searchParams.startObject) {
        if (searchParams.startObject) {
            visit(searchParams.startObject);
        }
    } else {
        for (let id in data.rootObjects) {
            visit(data.rootObjects[id]);
        }
    }
}

function arrayToMap(array: any[]): { [key: string]: any } {
    const map: { [key: string]: any } = {};
    for (let i = 0, len = array.length; i < len; i++) {
        map[array[i]] = true;
    }
    return map;
}
