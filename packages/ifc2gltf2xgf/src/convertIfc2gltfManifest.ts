import {ModelChunksManifestParams} from "@xeokit/core";
import {Ifc2gltfManifestParams} from "./Ifc2gltfManifestParams";

/**
 * TODO
 */
function convertIfc2gltfManifest(ifc2gltfManifestParams: Ifc2gltfManifestParams): ModelChunksManifestParams {
    const chunksManifest: ModelChunksManifestParams = {
        sceneModelMIMEType: "arraybuffer",
        sceneModelFiles: [],
        dataModelFiles: []
    };
    const {gltfOutFiles, metadataOutFiles} = ifc2gltfManifestParams;
    if (gltfOutFiles) {
        for (let i = 0, len = gltfOutFiles.length; i < len; i++) {
            chunksManifest.sceneModelFiles[i] = stripPathFromFilename(gltfOutFiles[i]);
        }
    }
    if (metadataOutFiles) {
        for (let i = 0, len = metadataOutFiles.length; i < len; i++) {
            chunksManifest.dataModelFiles[i] = stripPathFromFilename(metadataOutFiles[i]);
        }
    }
    return chunksManifest;
}

function stripPathFromFilename(fullPath) {
    return fullPath.split(/[/\\]/).pop();
}

export {convertIfc2gltfManifest};
