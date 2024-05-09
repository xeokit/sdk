import {AmbientLight, DirLight, PointLight} from "@xeokit/viewer";
import {DTXLayerRenderer} from "./../DTXLayerRenderer";
import {DTXTrianglesLayer} from "./DTXTrianglesLayer";

/**
 * @private
 */
export abstract class DTXTrianglesRenderer extends DTXLayerRenderer {

    draw( layer: DTXTrianglesLayer, renderPass: number) {

        super.draw(layer, renderPass);

        const renderState = layer.renderState;
        const program = this.program;
        const renderContext = this.renderContext;
        const gl = this.renderContext.gl;
        const samplers = this.samplers;

        if (samplers.primitiveToSubMeshLookupDataTexture) {
            if (renderState.numIndices8Bits > 0) {
                renderState.dataTextureSet.primitiveToSubMeshLookup8BitsDataTexture.bindTexture(program, samplers.primitiveToSubMeshLookupDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices8BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices8Bits);
            }
            if (renderState.numIndices16Bits > 0) {
                renderState.dataTextureSet.primitiveToSubMeshLookup16BitsDataTexture.bindTexture(program, samplers.primitiveToSubMeshLookupDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices16BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices16Bits);
            }
            if (renderState.numIndices32Bits > 0) {
                renderState.dataTextureSet.primitiveToSubMeshLookup32BitsDataTexture.bindTexture(program, samplers.primitiveToSubMeshLookupDataTexture, renderContext.nextTextureUnit);
                renderState.dataTextureSet.indices32BitsDataTexture.bindTexture(program, samplers.indicesDataTexture, renderContext.nextTextureUnit);
                gl.drawArrays(gl.TRIANGLES, 0, renderState.numIndices32Bits);
            }
        }
    }

    /**
     * Vertex shader lighting definitions.
     * @protected
     */
    protected get vertTrianglesLightingDefs(): string {
        const src = [];
        // src.push(`vec3 octDecode(vec2 oct) {
        //     vec3 v = vec3(oct.xy, 1.0 - abs(oct.x) - abs(oct.y));
        //     if (v.z < 0.0) {
        //         v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);
        //     }
        //     return normalize(v);
        // }`);
        src.push(`

            // TrianglesRenderer.vertTrianglesLightingDefs()

            uniform vec4 lightAmbient;`);
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
        src.push(`
            uniform vec4 color;
            out vec4 vColor;
             `);
        return src.join("\n");
    }

    /**
     * Vertex shader triangle rendering samplers.
     * @protected
     */
    protected get vertTrianglesDataTextureDefs(): string {
        return `

                // TrianglesRenderer.vertTrianglesDataTextureDefs()

                uniform mediump usampler2D              primitiveToSubMeshLookupDataTexture;    // Maps primitive -> SubMesh index
                uniform lowp    usampler2D              subMeshAttributesDataTexture;           // Per SubMesh flags, color, pick color
                uniform mediump sampler2D               subMeshInstanceMatricesDataTexture;     // Per SubMesh instancing matrix
                uniform mediump sampler2D               subMeshDecompressMatricesDataTexture;   // Per SubMesh positions decompress matrix
                uniform highp   sampler2D               subMeshOffsetsDataTexture;              // Per SubMesh offset translation vector
                uniform mediump usampler2D              positionsCompressedDataTexture;         // All compressed vertex positions
                uniform highp   usampler2D              indicesDataTexture;                     // All indices
                uniform highp   usampler2D              edgeIndicesDataTexture;                 // All edge indices`
    }

    /**
     * Vertex shader triangles clip space position and view space normal.
     * @protected
     */
    protected get vertTriangleVertexPosition() {
        return `

                // TrianglesRenderer.vertTriangleVertexPosition()

                // Primitive -> SubMesh lookup

                int     primitiveIndex                  = gl_VertexID / 3;
                ivec2   primitiveIndexCoords            = ivec2((primitiveIndex >> 3) & 4095, (primitiveIndex >> 3) >> 12);

                int     subMeshIndex                    = int( texelFetch( primitiveToSubMeshLookupDataTexture, primitiveIndexCoords, 0 ).r );
                ivec2   subMeshIndexCoords              = ivec2(subMeshIndex % 512, subMeshIndex / 512);

                // SubMesh Flags

                uvec4   flags                           = texelFetch( subMeshAttributesDataTexture, ivec2(subMeshIndexCoords.x * 8 + 2, subMeshIndexCoords.y ), 0);
                uvec4   flags2                          = texelFetch( subMeshAttributesDataTexture, ivec2(subMeshIndexCoords.x * 8 + 3, subMeshIndexCoords.y ), 0);

                // Render pass masking

                if (int(flags.z) != renderPass) {
                    gl_Position = vec4(3.0, 3.0, 3.0, 1.0); // Outside clip volume
                    return;
                }

                ivec4   packedVertexBase                = ivec4( texelFetch( subMeshAttributesDataTexture, ivec2( subMeshIndexCoords.x * 8 + 4, subMeshIndexCoords.y ), 0 ));
                ivec4   packedIndexBaseOffset           = ivec4( texelFetch( subMeshAttributesDataTexture, ivec2( subMeshIndexCoords.x * 8 + 5, subMeshIndexCoords.y ), 0 ));

                int     indexBaseOffset                 = (packedIndexBaseOffset.r << 24) + (packedIndexBaseOffset.g << 16) + (packedIndexBaseOffset.b << 8) + packedIndexBaseOffset.a;

                ivec2   triangleIndicesIndex            = ivec2( (primitiveIndex - indexBaseOffset) & 4095, (primitiveIndex - indexBaseOffset) >> 12 );
                ivec3   triangleIndices                 = ivec3( texelFetch( indicesDataTexture, triangleIndicesIndex, 0));
                ivec3   triangleIndicesUnique           = triangleIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;

                ivec3   indexPositionH                  = triangleIndicesUnique & 4095;
                ivec3   indexPositionV                  = triangleIndicesUnique >> 12;

                mat4    instanceMatrix                  = mat4( texelFetch( subMeshInstanceMatricesDataTexture,   ivec2( subMeshIndexCoords.x * 4 + 0, subMeshIndexCoords.y ), 0),
                                                                texelFetch( subMeshInstanceMatricesDataTexture,   ivec2( subMeshIndexCoords.x * 4 + 1, subMeshIndexCoords.y ), 0),
                                                                texelFetch( subMeshInstanceMatricesDataTexture,   ivec2( subMeshIndexCoords.x * 4 + 2, subMeshIndexCoords.y ), 0),
                                                                texelFetch( subMeshInstanceMatricesDataTexture,   ivec2( subMeshIndexCoords.x * 4 + 3, subMeshIndexCoords.y ), 0));

                mat4    decompressMatrix                = mat4( texelFetch( subMeshDecompressMatricesDataTexture, ivec2( subMeshIndexCoords.x * 4 + 0, subMeshIndexCoords.y ), 0),
                                                                texelFetch( subMeshDecompressMatricesDataTexture, ivec2( subMeshIndexCoords.x * 4 + 1, subMeshIndexCoords.y ), 0),
                                                                texelFetch( subMeshDecompressMatricesDataTexture, ivec2( subMeshIndexCoords.x * 4 + 2, subMeshIndexCoords.y ), 0),
                                                                texelFetch( subMeshDecompressMatricesDataTexture, ivec2( subMeshIndexCoords.x * 4 + 3, subMeshIndexCoords.y ), 0));

                mat4    decompressAndInstanceMatrix     = instanceMatrix * decompressMatrix;

                uint    solid                           = texelFetch (subMeshAttributesDataTexture, ivec2(subMeshIndexCoords.x*8+7, subMeshIndexCoords.y), 0).r;

                        positions[0]                    = vec3( texelFetch( positionsCompressedDataTexture,     ivec2( indexPositionH.r, indexPositionV.r ), 0));
                        positions[1]                    = vec3( texelFetch( positionsCompressedDataTexture,     ivec2( indexPositionH.g, indexPositionV.g ), 0));
                        positions[2]                    = vec3( texelFetch( positionsCompressedDataTexture,     ivec2( indexPositionH.b, indexPositionV.b ), 0));

                vec3    position                        = positions[gl_VertexID % 3];

                if (solid != 1u) {

                    vec3 normal     = normalize( cross( positions[2] - positions[0], positions[1] - positions[0] ) );
                    vec3 viewNormal = -normalize( (transpose( inverse( viewMatrix * decompressAndInstanceMatrix )) * vec4( normal, 1 )).xyz);

                    if ( isPerspectiveMatrix( projMatrix )) {

                        vec3 uCameraEyeRtcInQuantizedSpace = ( inverse( sceneModelMatrix * decompressAndInstanceMatrix ) * vec4( uCameraEyeRtc, 1 ) ).xyz;

                        if ( dot( position.xyz - uCameraEyeRtcInQuantizedSpace, normal ) < 0.0 ) {
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

               vec4     worldPosition                   = sceneModelMatrix * (decompressAndInstanceMatrix * vec4( position, 1.0 ));
               vec4     clipPos                         = projMatrix * (viewMatrix * worldPosition);

                        gl_Position                     = clipPos;`;
    }

    /**
     * Vertex shader lighting calculation.
     * @protected
     */
    protected get vertTrianglesLighting(): string {

        const src = [`

                // TrianglesRenderer.vertTrianglesLighting()
`];

        src.push("vec4      viewPosition    = viewMatrix * worldPosition; ");
        // src.push("vec4      modelNormal     = vec4(octDecode(normal.xy), 0.0); ");
        // src.push("vec4      worldNormal     = worldNormalMatrix * vec4(dot(modelNormal, modelNormalMatrixCol0), dot(modelNormal, modelNormalMatrixCol1), dot(modelNormal, modelNormalMatrixCol2), 0.0);");
        // src.push("vec3      viewNormal      = normalize(vec4(viewNormalMatrix * worldNormal).xyz);");
        src.push("vec3      viewNormal2      = vec3(1.0, 1.0, 1.0);");
        src.push("vec3      reflectedColor   = vec3(1.0, 1.0, 1.0);");
        src.push("vec3      viewLightDir     = vec3(0.0, 0.0, -1.0);");
        src.push("float     lambertian       = 1.0;");

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
        //src.push("vColor =  vec4((lightAmbient.rgb * lightAmbient.a * rgb) + (reflectedColor * rgb), float(color.a) / 255.0);");
        src.push("vColor =  vec4(rgb, 1.0);");
        return src.join("\n");
    }

    /**
     * Vertex shader edges gl_Position.
     * @protected
     */
    protected get vertTriangleEdgesVertexPosition() {
        return `

                // TrianglesRenderer.vertTriangleEdgesVertexPosition()

                int     primitiveIndex                  = gl_VertexID / 2;
                int     h_packed_object_id_index        = (primitiveIndex >> 3) & 4095;
                int     v_packed_object_id_index        = (primitiveIndex >> 3) >> 12;
                int     subMeshIndex                    = int(texelFetch(primitiveToSubMeshLookupDataTexture, ivec2(h_packed_object_id_index, v_packed_object_id_index), 0).r);
                ivec2   subMeshIndexCoords              = ivec2(subMeshIndex % 512, subMeshIndex / 512);
                uvec4   flags                           = texelFetch (subMeshAttributesDataTexture, ivec2(subMeshIndexCoords.x * 8+2, subMeshIndexCoords.y), 0);
                uvec4   flags2                          = texelFetch (subMeshAttributesDataTexture, ivec2(subMeshIndexCoords.x * 8+3, subMeshIndexCoords.y), 0);

                if (int(flags.z) != renderPass) {
                    gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
                    return;
                }

                ivec4   packedVertexBase                = ivec4(texelFetch (subMeshAttributesDataTexture, ivec2(subMeshIndexCoords.x*8+4, subMeshIndexCoords.y), 0));
                ivec4   packedEdgeIndexBaseOffset       = ivec4(texelFetch (subMeshAttributesDataTexture, ivec2(subMeshIndexCoords.x*8+6, subMeshIndexCoords.y), 0));
                int     edgeIndexBaseOffset             = (packedEdgeIndexBaseOffset.r << 24) + (packedEdgeIndexBaseOffset.g << 16) + (packedEdgeIndexBaseOffset.b << 8) + packedEdgeIndexBaseOffset.a;
                int     h_index                         = (primitiveIndex - edgeIndexBaseOffset) & 4095;
                int     v_index                         = (primitiveIndex - edgeIndexBaseOffset) >> 12;
                ivec3   triangleIndices                 = ivec3(texelFetch(edgeIndicesDataTexture, ivec2(h_index, v_index), 0));
                ivec3   triangleIndicesUnique           = triangleIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;
                ivec3   indexPositionH                  = triangleIndicesUnique & 4095;
                ivec3   indexPositionV                  = triangleIndicesUnique >> 12;
                mat4    instanceMatrix                  = mat4 (texelFetch (subMeshInstanceMatricesDataTexture, ivec2(subMeshIndexCoords.x*4+0, subMeshIndexCoords.y), 0), texelFetch (subMeshInstanceMatricesDataTexture, ivec2(subMeshIndexCoords.x*4+1, subMeshIndexCoords.y), 0), texelFetch (subMeshInstanceMatricesDataTexture, ivec2(subMeshIndexCoords.x*4+2, subMeshIndexCoords.y), 0), texelFetch (subMeshInstanceMatricesDataTexture, ivec2(subMeshIndexCoords.x*4+3, subMeshIndexCoords.y), 0));
                mat4    decompressAndInstanceMatrix     = instanceMatrix * mat4 (texelFetch (subMeshDecompressMatricesDataTexture, ivec2(subMeshIndexCoords.x*4+0, subMeshIndexCoords.y), 0), texelFetch (subMeshDecompressMatricesDataTexture, ivec2(subMeshIndexCoords.x*4+1, subMeshIndexCoords.y), 0), texelFetch (subMeshDecompressMatricesDataTexture, ivec2(subMeshIndexCoords.x*4+2, subMeshIndexCoords.y), 0), texelFetch (subMeshDecompressMatricesDataTexture, ivec2(subMeshIndexCoords.x*4+3, subMeshIndexCoords.y), 0));
                vec3    position                        = vec3(texelFetch(positionsCompressedDataTexture, ivec2(indexPositionH, indexPositionV), 0));
                vec4    worldPosition                   = sceneModelMatrix *  (decompressAndInstanceMatrix * vec4(position, 1.0));
                vec4    viewPosition                    = viewMatrix * worldPosition;
                vec4    clipPos                         = projMatrix * viewPosition;
                        gl_Position                     = clipPos;`;
    }

    /**
     * Fragment shader triangles color input and output definitions.
     * @protected
     */
    protected get fragTrianglesLightingDefs(): string {
        return `in vec4 vColor;
                out vec4 outColor;`;
    }

    /**
     * Fragment shader triangles ambient shadows.
     * @protected
     */
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

    /**
     * Fragment shader triangles color output.
     * @protected
     */
    protected get fragTrianglesLighting(): string {
        return `outColor = vColor;`;
    }
}
