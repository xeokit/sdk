import {LayerRenderer} from "./LayerRenderer";
import type {RenderContext} from "../RenderContext";

export class QualityColorTrianglesRenderer extends LayerRenderer {

    constructor(renderContext: RenderContext) {
        super(renderContext);
    }

     buildVertexShader(): string {
        return `${this.vertHeader}   
        
                uniform int                 renderPass;   
                        
                uniform highp   mat4        viewMatrix;
                uniform highp   mat4        projMatrix;
                uniform highp   mat4        worldMatrix;
                
                uniform mediump sampler2D   eachMeshMatrices;
                uniform lowp    usampler2D  eachMeshAttributes;
                uniform highp   sampler2D   eachMeshOffset;
                uniform mediump usampler2D  positions;
                uniform highp   usampler2D  indices;
                uniform mediump usampler2D  eachPrimitiveMesh;
                
                uniform  float  logDepthBufFC;
                 
                out vec4        worldPosition;
                flat out int    meshFlags2r;                       
                out uvec4       meshColor;
                out float       fragDepth;
                
                bool isPerspectiveMatrix(mat4 m) {
                    return (m[2][3] == - 1.0);
                }
                
                out float isPerspective;
                    
                void main(void) {
                                   
                    int triangleIndex      = gl_VertexID / 3;
                    
                    int hPackedMeshIdIndex = (triangleIndex >> 3) & 1023;
                    int vPackedMeshIdIndex = (triangleIndex >> 3) >> 10;
                    
                    int meshIndex          = int(texelFetch(eachPrimitiveMesh, ivec2(hPackedMeshIdIndex, vPackedMeshIdIndex), 0).r);                   
                    uvec4 meshFlags        = texelFetch (eachMeshAttributes, ivec2(2, meshIndex), 0);

                    if (int(meshFlags.x) != renderPass) {
                        gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
                        return;
                    } 
                 
                    mat4 viewMatrix  = mat4 (texelFetch (cameraMatrices,     ivec2(0, 0), 0), texelFetch (cameraMatrices,     ivec2(1, 0), 0), texelFetch (cameraMatrices,     ivec2(2, 0), 0), texelFetch (cameraMatrices,     ivec2(3, 0), 0));
                    mat4 projMatrix  = mat4 (texelFetch (cameraMatrices,     ivec2(0, 2), 0), texelFetch (cameraMatrices,     ivec2(1, 2), 0), texelFetch (cameraMatrices,     ivec2(2, 2), 0), texelFetch (cameraMatrices,     ivec2(3, 2), 0));
                    mat4 worldMatrix = mat4 (texelFetch (sceneModelMatrices, ivec2(0, 0), 0), texelFetch (sceneModelMatrices, ivec2(1, 0), 0), texelFetch (sceneModelMatrices, ivec2(2, 0), 0), texelFetch (sceneModelMatrices, ivec2(3, 0), 0));
                
                    uvec4 meshFlags2 = texelFetch (eachMeshAttributes, ivec2(3, meshIndex), 0);

                    ivec4 packedVertexBase = ivec4(texelFetch (eachMeshAttributes, ivec2(4, meshIndex), 0));
                    ivec4 packedIndexBaseOffset = ivec4(texelFetch (eachMeshAttributes, ivec2(5, meshIndex), 0));
                    int indexBaseOffset = (packedIndexBaseOffset.r << 24) + (packedIndexBaseOffset.g << 16) + (packedIndexBaseOffset.b << 8) + packedIndexBaseOffset.a;

                    int hIndex = (triangleIndex - indexBaseOffset) & 1023;
                    int vIndex = (triangleIndex - indexBaseOffset) >> 10;

                    ivec3 vertexIndices = ivec3(texelFetch(indices, ivec2(hIndex, vIndex), 0));
                    ivec3 uniqueVertexIndexes = vertexIndices + (packedVertexBase.r << 24) + (packedVertexBase.g << 16) + (packedVertexBase.b << 8) + packedVertexBase.a;

                    ivec3 indexPositionH = uniqueVertexIndexes & 1023;
                    ivec3 indexPositionV = uniqueVertexIndexes >> 10;

                    mat4 positionsDecompressMatrix = mat4 (texelFetch (eachMeshMatrices, ivec2(0, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(1, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(2, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(3, meshIndex), 0));
                    mat4 meshMatrix = mat4 (texelFetch (eachMeshMatrices, ivec2(4, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(5, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(6, meshIndex), 0), texelFetch (eachMeshMatrices, ivec2(7, meshIndex), 0));

                    _positions[0] = vec3(texelFetch(positions, ivec2(indexPositionH.r, indexPositionV.r), 0));
                    _positions[1] = vec3(texelFetch(positions, ivec2(indexPositionH.g, indexPositionV.g), 0));
                    _positions[2] = vec3(texelFetch(positions, ivec2(indexPositionH.b, indexPositionV.b), 0));
  
                    vec3  position      = _positions[gl_VertexID % 3];
                   
                    vec4  _worldPosition = worldMatrix * ((meshMatrix * positionsDecompressMatrix) * vec4(position, 1.0)); 
                    vec4  viewPosition  = viewMatrix * _worldPosition;                   
                    vec4 clipPos        = projMatrix * viewPosition;

                    meshFlags2r     = meshFlags2.r;                     
                    meshColor      = texelFetch (eachMeshAttributes, ivec2(0, meshIndex), 0);                          
                    fragDepth      = 1.0 + clipPos.w;");
                    isPerspective  = float (isPerspectiveMatrix(projMatrix));
                    worldPosition  = _worldPosition;");                                                 
                    gl_Position    = clipPos;
                }`;
    }

    buildFragmentShader(): string {
        return `${this.fragHeader}                        
    
                in uvec4        meshColor;
                in float        fragDepth;
                in float        isPerspective;    
                in vec4         worldPosition;
                in int          meshFlags2r;        
                uniform float   logDepthBufFC;                        
    
                ${this.fragSectionPlaneDefs}                  
                ${this.fragLightSourceUniforms}                                                             
    
                out vec4 outColor;        
    
                void main(void) {         
                
                // src.push("float lambertian = 1.0;");
                // 
                //  vec3 xTangent = dFdx( vViewPosition.xyz );
                //  vec3 yTangent = dFdy( vViewPosition.xyz );
                // 
                //  vec3 viewNormal = normalize( cross( xTangent, yTangent ) );        
    
                    ${this.fragSectionPlanesSlice}                                    
                    ${this.fragFlatShading}     
          
                    outColor = meshColor;                   
                    gl_FragDepth = isPerspective == 0.0 ? gl_FragCoord.z : log2( fragDepth ) * logDepthBufFC * 0.5;                        
                }`;
    }

    // get lambertianLighting() : string{
    //     const src = [];
    //     src.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);");
    //     src.push("vec3 viewLightDir = vec3(0.0, 0.0, -1.0);");
    //     src.push("float lambertian = 1.0;");
    //     for (let i = 0, len = this.view.lightsList.length; i < len; i++) {
    //         const light = this.view.lightsList[i];
    //         if (light.type === "ambient") {
    //             continue;
    //         }
    //         if (light.type === "dir") {
    //             src.push("viewLightDir = normalize((viewMatrix * vec4(lightDir" + i + ", 0.0)).xyz);");
    //         } else {
    //             continue;
    //         }
    //         src.push("lambertian = max(dot(-viewNormal, viewLightDir), 0.0);");
    //         src.push("reflectedColor += lambertian * (lightColor" + i + ".rgb * lightColor" + i + ".a);");
    //     }
    //     return src.join("\n");
    // }
    getHash(): string {
        return "";
    }
}