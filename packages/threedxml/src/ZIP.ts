import * as zip from "@zip.js/zip.js";

/**
 * @private
 */
export class ZIP {

    #reader: any;
    #entries: { [key: string]: zip.Entry };

    constructor() {
        this.#entries = {};
    }

    // loadSrc(src: string): Promise<any> {
    //     return new Promise<void>((resolve, reject) => {
    //         this.#reader = new zip.ZipReader(new zip.HttpReader(src));
    //         this.#reader
    //             .getEntries()
    //             .then((entries: zip.Entry[]) => {
    //                 this.#entries = entries.reduce((map: any, entry: zip.Entry) => {
    //                     map[entry.filename] = entry.filename;
    //                     return map;
    //                 }, {});
    //                 resolve();
    //             })
    //             .catch((errMsg: string) => {
    //                 reject(new SDKError(`Error parsing 3DXML: ${errMsg}`));
    //             });
    //     });
    // }

    loadFileData(fileData: Blob): Promise<any> {
        return new Promise<void>((resolve, reject) => {
            this.#reader = new zip.ZipReader(new zip.BlobReader(fileData));
            this.#reader
                .getEntries()
                .then((entries: zip.Entry[]) => {
                    for (let i = 0; i < entries.length; i++) {
                        const entry = entries[i];
                        this.#entries[entry.filename] = entry;
                    }
                    resolve();
                })
                .catch((errMsg: string) => {
                    reject(errMsg);
                });
        });
    }

    getFile(src: string, ok: (arg0: any, arg1: any) => void, err: (arg0: string) => void) {
        const entry = this.#entries[src];
        if (entry) {
            const textWriter = new zip.TextWriter();
            if (entry.getData) {
                entry.getData(textWriter)
                    .then(text => {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(text, "text/xml");
                        const json = this.#xmlToJSON(xmlDoc, {});
                        ok(json, xmlDoc);
                    });
            }
        } else {
            err(`ZIP entry not found: ${src}`);
        }
    };

    #xmlToJSON(node: any, attributeRenamer: any): any {
        if (node.nodeType === node.TEXT_NODE) {
            const v = node.nodeValue;
            if (v.match(/^\s+$/) === null) {
                return v;
            }
        } else {
            if (node.nodeType === node.ELEMENT_NODE ||
                node.nodeType === node.DOCUMENT_NODE) {
                const json: any = {type: node.nodeName, children: []};
                if (node.nodeType === node.ELEMENT_NODE) {
                    for (let j = 0; j < node.attributes.length; j++) {
                        const attribute = node.attributes[j];
                        const nm = attributeRenamer[attribute.nodeName] || attribute.nodeName;
                        json[nm] = attribute.nodeValue;
                    }
                }
                for (let i = 0; i < node.childNodes.length; i++) {
                    const item = node.childNodes[i];
                    const j = this.#xmlToJSON(item, attributeRenamer);
                    if (j) {
                        json.children.push(j);
                    }
                }
                return json;
            }
        }
    }

    destroy() {
        this.#reader.close(function () {
            // onclose callback
        });
    };
}