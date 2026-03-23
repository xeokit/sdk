
import type {XKTData} from "./XKTData";
import type {XKTDataDeflated} from "./XKTDataDeflated";

/**
 * @private
 */
export function inflateXKT(xktDataDeflated: XKTDataDeflated): XKTData {

  // function inflate(array: any, options?: any): any {
  //   // @ts-ignore
  //   return (array.length === 0) ? [] : pako.(array, options).buffer;
  // }


  return <XKTData>{
    metadata: JSON.parse(xktDataDeflated.metadata),
    textureData: new Uint8Array((xktDataDeflated.textureData)), // <<----------------------------- ??? ZIPPing to blame?
    eachTextureDataPortion: new Uint32Array((xktDataDeflated.eachTextureDataPortion)),
    eachTextureAttributes: new Uint16Array((xktDataDeflated.eachTextureAttributes)),
    positions: new Uint16Array((xktDataDeflated.positions)),
    normals: new Int8Array((xktDataDeflated.normals)),
    colors: new Uint8Array((xktDataDeflated.colors)),
    uvs: new Float32Array((xktDataDeflated.uvs)),
    indices: new Uint32Array((xktDataDeflated.indices)),
    edgeIndices: new Uint32Array((xktDataDeflated.edgeIndices)),
    eachMaterialTextures: new Int32Array((xktDataDeflated.eachMaterialTextures)),
    matrices: new Float32Array((xktDataDeflated.matrices)),
    reusedGeometriesDecodeMatrix: new Float32Array((xktDataDeflated.reusedGeometriesDecodeMatrix)),
    eachGeometryPrimitiveType: new Uint8Array((xktDataDeflated.eachGeometryPrimitiveType)),
    eachGeometryPositionsPortion: new Uint32Array((xktDataDeflated.eachGeometryPositionsPortion)),
    eachGeometryNormalsPortion: new Uint32Array((xktDataDeflated.eachGeometryNormalsPortion)),
    eachGeometryColorsPortion: new Uint32Array((xktDataDeflated.eachGeometryColorsPortion)),
    eachGeometryUVsPortion: new Uint32Array((xktDataDeflated.eachGeometryUVsPortion)),
    eachGeometryIndicesPortion: new Uint32Array((xktDataDeflated.eachGeometryIndicesPortion)),
    eachGeometryEdgeIndicesPortion: new Uint32Array((xktDataDeflated.eachGeometryEdgeIndicesPortion)),
    eachMeshGeometriesPortion: new Uint32Array((xktDataDeflated.eachMeshGeometriesPortion)),
    eachMeshMatricesPortion: new Uint32Array((xktDataDeflated.eachMeshMatricesPortion)),
    eachMeshMaterial: new Int32Array((xktDataDeflated.eachMeshMaterial)), // Can be -1
    eachMeshMaterialAttributes: new Uint8Array((xktDataDeflated.eachMeshMaterialAttributes)),
    eachEntityId: JSON.parse(xktDataDeflated.eachEntityId),
    eachEntityMeshesPortion: new Uint32Array((xktDataDeflated.eachEntityMeshesPortion)),
    eachTileAABB: new Float64Array((xktDataDeflated.eachTileAABB)),
    eachTileEntitiesPortion: new Uint32Array((xktDataDeflated.eachTileEntitiesPortion)),
  };
}
