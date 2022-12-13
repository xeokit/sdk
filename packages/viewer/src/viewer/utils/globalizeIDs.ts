export function unglobalizeObjectId(modelId: string, globalId: string): string {
    const idx = globalId.indexOf("#");
    return (idx === modelId.length && globalId.startsWith(modelId)) ? globalId.substring(idx + 1) : globalId;
}

export function globalizeObjectId(modelId: string, objectId: string): string {
    return (modelId + "#" + objectId)
}