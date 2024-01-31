import {AmbientLight, DirLight, PointLight} from "@xeokit/viewer";
import {LayerRenderer} from "../LayerRenderer";
import {Layer} from "../Layer";

/**
 * @private
 */
export abstract class TrianglesRenderer extends LayerRenderer {

    drawTriangles(layer: Layer) {

        super.draw(layer);

        const renderState = layer.renderState;
        const program = this.program;
        const renderContext = this.renderContext;
        const gl = this.renderContext.gl;
        const samplers = this.samplers;

        if (samplers.perPrimitiveSubMeshDataTexture) {
            if (renderState.numIndices8Bits > 0) {
                renderState.dataTextureSet.perPrimitiveSubMesh8BitsDataTexture.bindTexture(program, samplers.perPrimitiveSubMeshDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices8BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices8Bits);
            }
            if (renderState.numIndices16Bits > 0) {
                renderState.dataTextureSet.perPrimitiveSubMesh16BitsDataTexture.bindTexture(program, samplers.perPrimitiveSubMeshDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices16BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices16Bits);
            }
            if (renderState.numIndices32Bits > 0) {
                renderState.dataTextureSet.perPrimitiveSubMesh32BitsDataTexture.bindTexture(program, samplers.perPrimitiveSubMeshDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices32BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices32Bits);
            }
        }
    }

    protected get vertTrianglesLightingDefs(): string {
        const src = [];
        src.push(`vec3 octDecode(vec2 oct) {
            vec3 v = vec3(oct.xy, 1.0 - abs(oct.x) - abs(oct.y));
            if (v.z < 0.0) {
                v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);
            }
            return normalize(v);
        }`);
        src.push(`uniform vec4 lightAmbient;`);
        for (let i = 0, len = this.renderContext.view.lightsList.length; i < len; i++) {
            const light = this.renderContext.view.lightsList[i];
            if (light instanceof AmbientLight) {
                continue;
            }
            src.push(`uniform vec4 lightColor${i};`);
            if (light instanceof DirLight) {
                src.push(`uniform vec3 lightDir${i};`);
            }
            if (light instanceof PointLight) {
                src.push(`uniform vec3 lightPos${i};`);
            }
        }
        src.push("uniform vec4 color;");
        src.push("out vec4 vColor;");
        return src.join("\n");
    }

    protected get vertTrianglesLighting(): string {
        const src = [];
        src.push("vec4      viewPosition    = viewMatrix * worldPosition; ");
        // src.push("vec4      modelNormal     = vec4(octDecode(normal.xy), 0.0); ");
        // src.push("vec4      worldNormal     = worldNormalMatrix * vec4(dot(modelNormal, modelNormalMatrixCol0), dot(modelNormal, modelNormalMatrixCol1), dot(modelNormal, modelNormalMatrixCol2), 0.0);");
        // src.push("vec3      viewNormal      = normalize(vec4(viewNormalMatrix * worldNormal).xyz);");
        src.push("vec3      viewNormal2      = vec3(1.0, 1.0, 1.0);");
        src.push("vec3      reflectedColor  = vec3(0.0, 0.0, 0.0);");
        src.push("vec3      viewLightDir    = vec3(0.0, 0.0, -1.0);");
        src.push("float     lambertian      = 1.0;");
        for (let i = 0, len = this.renderContext.view.lightsList.length; i < len; i++) {
            const light: any = this.renderContext.view.lightsList[i];
            if (light instanceof AmbientLight) {
                continue;
            }
            if (light instanceof DirLight) {
                src.push(`viewLightDir = normalize((viewMatrix * vec4(lightDir${i}, 0.0)).xyz);`);
            }
            if (light instanceof PointLight) {
                src.push(`viewLightDir = -normalize((viewMatrix * vec4(lightPos${i}, 0.0)).xyz);`);
            }
            src.push("lambertian = max(dot(-viewNormal2, viewLightDir), 0.0);");
            src.push("reflectedColor += lambertian * (lightColor" + i + ".rgb * lightColor" + i + ".a);");
        }
        src.push("vec3 rgb = (vec3(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0));");
        src.push("vColor =  vec4((lightAmbient.rgb * lightAmbient.a * rgb) + (reflectedColor * rgb), float(color.a) / 255.0);");
        return src.join("\n");
    }

    protected get vertTrianglesDataTextureDefs(): string {
        return `uniform mediump usampler2D  perPrimitiveSubMeshDataTexture;                
                uniform lowp    usampler2D  perSubMeshAttributesDataTexture; 
                uniform mediump sampler2D   perSubMeshInstancingMatricesDataTexture; 
                uniform mediump sampler2D   perSubMeshDecodeMatricesDataTexture;                
                uniform highp   sampler2D   perSubmeshOffsetDataTexture;                           
                uniform mediump usampler2D  positionsCompressedDataTexture; 
                uniform highp   usampler2D  indicesDataTexture; 
                uniform highp   usampler2D  edgeIndicesDataTexture;`;
    }

    protected get vertTriangleVertexPosition() {
        return `int     polygonIndex                = gl_VertexID / 3;
                int     h_packed_object_id_index    = (polygonIndex >> 3) & 4095;
                int     v_packed_object_id_index    = (polygonIndex >> 3) >> 12;
                int     objectIndex                 = int(texelFetch(perPrimitiveSubMeshDataTexture, ivec2(h_packed_object_id_index, v_packed_object_id_index), 0).r);
                ivec2   objectIndexCoords           = ivec2(objectIndex % 512, objectIndex / 512);
                uvec4   flags                       = texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x * 8+2, objectIndexCoords.y), 0);
                uvec4   flags2                      = texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x * 8+3, objectIndexCoords.y), 0);
                if (int(flags.z) != renderPass) {               
                    gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
                    return;
                } 
                ivec4   packedVertexBase                = ivec4(texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+4, objectIndexCoords.y), 0));
                ivec4   packedIndexBaseOffset           = ivec4(texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+5, objectIndexCoords.y), 0));
                int     indexBaseOffset                 = (packedIndexBaseOffset.r << 24) + (packedIndexBaseOffset.g << 16) + (packedIndexBaseOffset.b << 8) + packedIndexBaseOffset.a;
                int     h_index                         = (polygonIndex - indexBaseOffset) & 4095;
                int     v_index                         = (polygonIndex - indexBaseOffset) >> 12;
                ivec3   vertexIndices                   = ivec3(texelFetch(indicesDataTexture, ivec2(h_index, v_index), 0));
                ivec3   uniqueVertexIndexes             = vertexIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;
                ivec3   indexPositionH                  = uniqueVertexIndexes & 4095;
                ivec3   indexPositionV                  = uniqueVertexIndexes >> 12;
                mat4    objectInstanceMatrix            = mat4 (texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+0, objectIndexCoords.y), 0), texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+1, objectIndexCoords.y), 0), texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+2, objectIndexCoords.y), 0), texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+3, objectIndexCoords.y), 0));
                mat4    objectDecodeAndInstanceMatrix   = objectInstanceMatrix * mat4 (texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+0, objectIndexCoords.y), 0), texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+1, objectIndexCoords.y), 0), texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+2, objectIndexCoords.y), 0), texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+3, objectIndexCoords.y), 0));
                uint    solid                           = texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+7, objectIndexCoords.y), 0).r;
                        positions[0]                    = vec3(texelFetch(positionsCompressedDataTexture, ivec2(indexPositionH.r, indexPositionV.r), 0));
                        positions[1]                    = vec3(texelFetch(positionsCompressedDataTexture, ivec2(indexPositionH.g, indexPositionV.g), 0));
                        positions[2]                    = vec3(texelFetch(positionsCompressedDataTexture, ivec2(indexPositionH.b, indexPositionV.b), 0));
                vec3    normal                          = normalize(cross(positions[2] - positions[0], positions[1] - positions[0]));
                vec3    position                        = positions[gl_VertexID % 3];
                vec3    viewNormal                      = -normalize((transpose(inverse(viewMatrix * objectDecodeAndInstanceMatrix)) * vec4(normal,1)).xyz);
                if (solid != 1u) {
                    if (isPerspectiveMatrix(projMatrix)) {
                        vec3 uCameraEyeRtcInQuantizedSpace = (inverse(sceneModelMatrix * objectDecodeAndInstanceMatrix) * vec4(uCameraEyeRtc, 1)).xyz;
                        if (dot(position.xyz - uCameraEyeRtcInQuantizedSpace, normal) < 0.0) {
                            position = positions[2 - (gl_VertexID % 3)];
                            viewNormal = -viewNormal;
                        }
                    } else {
                        if (viewNormal.z < 0.0) {
                            position = positions[2 - (gl_VertexID % 3)];
                            viewNormal = -viewNormal;
                        }
                    }
               }
               vec4 worldPosition = sceneModelMatrix *  (objectDecodeAndInstanceMatrix * vec4(position, 1.0));            
               vec4 clipPos = projMatrix * (viewMatrix * worldPosition);
               gl_Position = clipPos;`;
    }

    protected get vertTriangleEdgesVertexPosition() {
        return `int     polygonIndex                = gl_VertexID / 2;
                int     h_packed_object_id_index    = (polygonIndex >> 3) & 4095;
                int     v_packed_object_id_index    = (polygonIndex >> 3) >> 12;
                int     objectIndex                 = int(texelFetch(perPrimitiveSubMeshDataTexture, ivec2(h_packed_object_id_index, v_packed_object_id_index), 0).r);
                ivec2   objectIndexCoords           = ivec2(objectIndex % 512, objectIndex / 512);
                uvec4   flags                       = texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x * 8+2, objectIndexCoords.y), 0);
                uvec4   flags2                      = texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x * 8+3, objectIndexCoords.y), 0);
                if (int(flags.z) != renderPass) {               
                    gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
                    return;
                } 
                ivec4   packedVertexBase                = ivec4(texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+4, objectIndexCoords.y), 0));
                ivec4   packedEdgeIndexBaseOffset       = ivec4(texelFetch (perSubMeshAttributesDataTexture, ivec2(objectIndexCoords.x*8+6, objectIndexCoords.y), 0));
                int     edgeIndexBaseOffset             = (packedEdgeIndexBaseOffset.r << 24) + (packedEdgeIndexBaseOffset.g << 16) + (packedEdgeIndexBaseOffset.b << 8) + packedEdgeIndexBaseOffset.a;
                int     h_index                         = (polygonIndex - edgeIndexBaseOffset) & 4095;
                int     v_index                         = (polygonIndex - edgeIndexBaseOffset) >> 12;
                ivec3   vertexIndices                   = ivec3(texelFetch(edgeIndicesDataTexture, ivec2(h_index, v_index), 0));
                ivec3   uniqueVertexIndexes             = vertexIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;
                ivec3   indexPositionH                  = uniqueVertexIndexes & 4095;
                ivec3   indexPositionV                  = uniqueVertexIndexes >> 12;
                mat4    objectInstanceMatrix            = mat4 (texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+0, objectIndexCoords.y), 0), texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+1, objectIndexCoords.y), 0), texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+2, objectIndexCoords.y), 0), texelFetch (perSubMeshInstancingMatricesDataTexture, ivec2(objectIndexCoords.x*4+3, objectIndexCoords.y), 0));
                mat4    objectDecodeAndInstanceMatrix   = objectInstanceMatrix * mat4 (texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+0, objectIndexCoords.y), 0), texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+1, objectIndexCoords.y), 0), texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+2, objectIndexCoords.y), 0), texelFetch (perSubMeshDecodeMatricesDataTexture, ivec2(objectIndexCoords.x*4+3, objectIndexCoords.y), 0));             
                vec3    position                        = vec3(texelFetch(positionsCompressedDataTexture, ivec2(indexPositionH, indexPositionV), 0));
                vec4    worldPosition = sceneModelMatrix *  (objectDecodeAndInstanceMatrix * vec4(position, 1.0));
                vec4    viewPosition = viewMatrix * worldPosition;
                vec4    clipPos = projMatrix * viewPosition;
                        gl_Position = clipPos;`;
    }

    protected get fragTrianglesLightingDefs(): string {
        return `in vec4 vColor;
                out vec4 outColor;`;
    }

    protected get fragSAOOutput(): string {
        if (this.renderContext.view.sao.enabled) {
            // Doing SAO blend in the main solid fill draw shader just so that edge lines can be drawn over the top
            // Would be more efficient to defer this, then render lines later, using same depth buffer for Z-reject
            return `float viewportWidth     = uSAOParams[0];
                    float viewportHeight    = uSAOParams[1];
                    float blendCutoff       = uSAOParams[2];
                    float blendFactor       = uSAOParams[3];
                    vec2 uv                 = vec2(gl_FragCoord.x / viewportWidth, gl_FragCoord.y / viewportHeight);
                    float ambient           = smoothstep(blendCutoff, 1.0, unpackRGBToFloat(texture(uOcclusionTexture, uv))) * blendFactor;
                    outColor                = vec4(fragColor.rgb * ambient, 1.0);`;
        } else {
            return `outColor            = fragColor;`;
        }
    }

    protected get fragTrianglesLighting(): string {
        return `outColor = vColor;`;
    }
}
