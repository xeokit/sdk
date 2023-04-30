import type {Data} from "./Data";
import {SDKError} from "@xeokit/core";
import type {DataObject} from "./DataObject";

export class DataTraversalQuery {
    private data: Data;
    private startObjectId: any;
    private includeObjects: Boolean;
    private excludeObjects: Boolean;
    private includeRelating: Boolean;
    private excludeRelating: Boolean;
    private resultObjectIds: any;

    constructor(params: {
        data: Data
    }) {
        this.data = params.data;
    }

    /**
     * TODO
     */
    query(): void | SDKError {
        if (!this.data) {
            return new SDKError("Data already destroyed");
        }
        // const includeObjects = (this.includeObjects && this.includeObjects.length > 0) ? arrayToMap(this.includeObjects) : null;
        // const excludeObjects = (this.excludeObjects && this.excludeObjects.length > 0) ? arrayToMap(this.excludeObjects) : null;
        // const includeRelating = (this.includeRelating && this.includeRelating.length > 0) ? arrayToMap(this.includeRelating) : null;
        // const excludeRelating = (this.excludeRelating && this.excludeRelating.length > 0) ? arrayToMap(this.excludeRelating) : null;

         const visit = (dataObject: DataObject, depth: number) =>{
            if (!dataObject) {
                return;
            }
            let includeObject = true;
            // if (excludeObjects && excludeObjects[dataObject.type]) {
            //     includeObject = false;
            // } else { // @ts-ignore
            //     if (includeObjects && (!includeObjects[dataObject.type])) {
            //         includeObject = false;
            //     }
            // }
            // if (depth === 0 && this.includeStart === false) {
            //     includeObject = false;
            // }
            // if (includeObject) {
            //     if (this.resultObjectIds) {
            //         this.resultObjectIds.push(dataObject.id);
            //     } else if (this.resultObjects) {
            //         this.resultObjects.push(dataObject);
            //     } else if (this.resultCallback) {
            //         if (this.resultCallback(dataObject)) {
            //         }
            //     }
            // }
            const related = dataObject.related;
            for (let type in related) {
                const relations = related[type];
                if (relations) {
                    // for (let i = 0, len = relations.length; i < len; i++) {
                    //     let includeRelation = true;
                    //     if (excludeRelating && excludeRelating[dataObject.type]) {
                    //         includeRelation = false;
                    //     } else {
                    //         if (includeRelating && (!includeRelating[dataObject.type])) {
                    //             includeRelation = false;
                    //         }
                    //     }
                    //     if (includeRelation) {
                    //         visit(relations[i].relatedObject, depth + 1);
                    //     }
                    // }
                }
            }
        }

        const depth = 0;
        if (this.startObjectId) {
            const startObject = this.data.objects[this.startObjectId];
            if (!startObject) {
                return new SDKError(`Failed to search DataObjects - starting DataObject not found in Data: "${this.startObjectId}"`);
            }
            visit(startObject, depth);
        } else {
            for (let id in this.data.rootObjects) {
                visit(this.data.rootObjects[id], depth + 1);
            }
        }
    }
}