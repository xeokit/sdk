/**
 * Converts a file manifest from {@link @xeokit/ifc2gltf2xgf!Ifc2gltfManifestParams | Ifc2gltfManifestParams} to
 * {@link @xeokit/core!ModelChunksManifestParams | ModelChunksManifestParams}.
 */
function convertIfc2gltfManifest(ifc2gltfManifestParams) {
    const chunksManifest = {
        sceneModelMIMEType: "arraybuffer",
        sceneModelFiles: [],
        dataModelFiles: []
    };
    const { gltfOutFiles, metadataOutFiles } = ifc2gltfManifestParams;
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
export { convertIfc2gltfManifest };
//# sourceMappingURL=convertIfc2gltfManifest.js.map