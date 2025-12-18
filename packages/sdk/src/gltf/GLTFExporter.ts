import {type ModelEncodeParams, ModelExporter} from "../io";
import {Document, type mat4, WebIO,} from '@gltf-transform/core';
import {decompressPoint3WithAABB3} from "../compression";
import {createMat4Float64, createVec3Float64, mulMat4} from "../matrix";
import {createCoordinateSystemTransform} from "../scene";

const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();

/**
 * Exports a {@link scene!SceneModel | SceneModel} to glTF (2) format.
 *
 * For detailed usage, refer to {@link gltf | @xeokit/sdk/gltf}.
 */
export class GLTFExporter extends ModelExporter {
  constructor() {
    super({
      format: "glTF",
      fileDataType: "arraybuffer",
      encoders: {
        "2": encode2
      },
      defaultVersion: "2"
    });
  }
}

export function encode2(params: ModelEncodeParams, options?: any): Promise<any> {
  return new Promise<any>(function (resolve, reject) {

    const {sceneModel} = params;

    const coordinateSystemMatrix = options.coordinateSystem
      ? createCoordinateSystemTransform(sceneModel.scene.coordinateSystem, options.coordinateSystem, createMat4Float64())
      : null;

    const io = new WebIO({credentials: 'include'});
    const document = new Document();
    const gltfScene = document.createScene();
    const buffer = document.createBuffer();

    let primitivesCreated: Record<string, any> = {};

    for (let objectId in sceneModel.objects) {

      const sceneObject = sceneModel.objects[objectId];
      const sceneMeshes = sceneObject.meshes;

      const gltfObjectNode = document.createNode(sceneObject.id);
      gltfScene.addChild(gltfObjectNode);

      for (let j = 0, lenj = sceneMeshes.length; j < lenj; j++) {

        const sceneMesh = sceneMeshes[j];
        const sceneGeometry = sceneMesh.geometry;

        if (!sceneGeometry.positionsCompressed || !sceneGeometry.indices) {
          continue;
        }

        const aabb = sceneGeometry.aabb;
        let primitive = primitivesCreated[sceneGeometry.id];
        let positionAccessor, indexAccessor, colorAccessor;

        if (!primitive) {
          const coordinates: number[] = [];
          const colors: number[] = [];
          const positionsCompressed = sceneGeometry.positionsCompressed;
          const colorsCompressed = sceneGeometry.colorsCompressed;

          const hasVertexColors = !!colorsCompressed;

          for (let k = 0, lenk = positionsCompressed.length; k < lenk; k += 3) {
            tempVec3a[0] = positionsCompressed[k];
            tempVec3a[1] = positionsCompressed[k + 1];
            tempVec3a[2] = positionsCompressed[k + 2];
            decompressPoint3WithAABB3(tempVec3a, aabb, tempVec3b);
            coordinates.push(tempVec3b[0], tempVec3b[1], tempVec3b[2]);

            if (hasVertexColors) {
              const r = colorsCompressed[k] / 255;
              const g = colorsCompressed[k + 1] / 255;
              const b = colorsCompressed[k + 2] / 255;
              colors.push(r, g, b);
            }
          }

          positionAccessor = document.createAccessor()
            .setType('VEC3')
            .setArray(new Float32Array(coordinates))
            .setBuffer(buffer);

          indexAccessor = document.createAccessor()
            .setType('SCALAR')
            .setArray(new Uint32Array(sceneGeometry.indices))
            .setBuffer(buffer);

          primitive = document.createPrimitive()
            .setAttribute('POSITION', positionAccessor)
            .setIndices(indexAccessor);

          const material = document.createMaterial();

          if (hasVertexColors) {
            colorAccessor = document.createAccessor()
              .setType('VEC3')
              .setArray(new Float32Array(colors))
              .setBuffer(buffer);

            primitive.setAttribute('COLOR_0', colorAccessor);
           // material.setVertexColors(true);
            material.setBaseColorFactor([1, 1, 1, 1]); // Needed for vertex color modulation

          } else if (sceneMesh.color) {
            const meshColor = sceneMesh.color;
            const r = meshColor[0];
            const g = meshColor[1];
            const b = meshColor[2];
            const a = meshColor.length > 3 ? meshColor[3] : 1.0;
            material.setBaseColorFactor([r, g, b, a]);
          }

          primitive.setMaterial(material);
          primitivesCreated[sceneGeometry.id] = primitive;
        }

        const mesh = document.createMesh()
          .addPrimitive(primitive);

        const matrix = coordinateSystemMatrix
          ? mulMat4(sceneMesh.matrix, coordinateSystemMatrix, createMat4Float64())
          : sceneMesh.matrix;

        const node = document.createNode(sceneMesh.id)
          .setMesh(mesh)
          .setMatrix(<mat4>matrix);

        gltfObjectNode.addChild(node);
      }
    }

    io.writeBinary(document)
      .then(glb => resolve(glb))
      .catch(errMsg => reject(errMsg));
  });
}
