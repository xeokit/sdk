import {TRIANGLE_POSITION_DECODE_WGSL, TRIANGLE_RTC_TILE_WGSL} from "./TrianglePositionPacking";
import {
  triangleLogDepthFragmentOutputStruct,
  triangleLogDepthReturn,
  triangleLogDepthReturnType,
  triangleLogDepthVertexField,
  triangleLogDepthVertexWrite
} from "./TriangleLogDepth";

/**
 * WGSL shader for the current WebGPU indexed triangle color technique.
 *
 * @internal
 */
export function createTrianglesDrawColorShader(logDepth = false): string {
  return `
struct FrameUniforms {
  viewProjection: mat4x4<f32>,
  ambientLight: vec4<f32>,
  dirLightDirections: array<vec4<f32>, 3>,
  dirLightColors: array<vec4<f32>, 3>,
  sectionPlaneState: vec4<f32>,
  sectionPlanes: array<vec4<f32>, 8>,
  sectionPlaneCapColors: array<vec4<f32>, 8>,
  depthParams: vec4<f32>,
  pointParams0: vec4<f32>,
  pointParams1: vec4<f32>,
  lineParams: vec4<f32>,
  viewMatrix: mat4x4<f32>,
  splatParams: vec4<f32>,
  hemisphereSky: vec4<f32>,
  hemisphereGround: vec4<f32>,
  hemisphereUp: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct IBLUniforms {
  params: vec4<f32>,
  viewToWorld0: vec4<f32>,
  viewToWorld1: vec4<f32>,
  viewToWorld2: vec4<f32>,
};

@group(0) @binding(2) var<uniform> ibl: IBLUniforms;
@group(0) @binding(3) var iblSampler: sampler;
@group(0) @binding(4) var iblIrradianceCubemap: texture_cube<f32>;
@group(0) @binding(5) var iblPrefilteredCubemap: texture_cube<f32>;
@group(0) @binding(6) var iblBRDFLUT: texture_2d<f32>;

struct ShadowUniforms {
  lightViewProjections: array<mat4x4<f32>, 6>,
  params: vec4<f32>,
  lightDirection: vec4<f32>,
  debug: vec4<f32>,
  cameraView: mat4x4<f32>,
  cascadeSplits0: vec4<f32>,
  cascadeSplits1: vec4<f32>,
};

@group(3) @binding(0) var<uniform> shadow: ShadowUniforms;
@group(3) @binding(1) var shadowSampler: sampler_comparison;
@group(3) @binding(2) var shadowMap: texture_depth_2d_array;

@group(2) @binding(1) var colorSampler: sampler;
@group(2) @binding(2) var colorTexture: texture_2d<f32>;
@group(2) @binding(3) var metallicRoughnessSampler: sampler;
@group(2) @binding(4) var metallicRoughnessTexture: texture_2d<f32>;
@group(2) @binding(5) var normalSampler: sampler;
@group(2) @binding(6) var normalTexture: texture_2d<f32>;
@group(2) @binding(7) var emissiveSampler: sampler;
@group(2) @binding(8) var emissiveTexture: texture_2d<f32>;
@group(2) @binding(9) var occlusionSampler: sampler;
@group(2) @binding(10) var occlusionTexture: texture_2d<f32>;

struct MeshInstance {
  modelMatrix: mat4x4<f32>,
  color: vec4<f32>,
  flags: vec4<f32>,
  normalMatrix0: vec4<f32>,
  normalMatrix1: vec4<f32>,
  normalMatrix2: vec4<f32>,
};

@group(1) @binding(0) var<storage, read> instances: array<MeshInstance>;

${TRIANGLE_POSITION_DECODE_WGSL}
${TRIANGLE_RTC_TILE_WGSL}

struct VertexInput {
  @location(0) packedPosition: vec4<f32>,
  @location(1) vertexMetadata: vec2<u32>,
  @location(2) uv: vec2<f32>,
  @location(3) material0: vec4<f32>,
  @location(4) material1: vec4<f32>,
  @location(5) normal: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) worldPos: vec3<f32>,
  @location(2) clippable: f32,
  @location(3) rtcPos: vec3<f32>,
  @location(4) shadowPos: vec4<f32>,
  @location(5) uv: vec2<f32>,
  @location(6) material0: vec4<f32>,
  @location(7) material1: vec4<f32>,
  @location(8) normal: vec4<f32>,
${triangleLogDepthVertexField(logDepth, 9)}
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let instance = instances[input.vertexMetadata.x];
  let rtcTile = getInstanceRTCTile(instance);
  let localPosition = decodePackedPosition(input.packedPosition, input.vertexMetadata.y);
  let rtcWorldPos = instance.modelMatrix * vec4<f32>(localPosition, 1.0);
  var output: VertexOutput;
  output.position = rtcTile.viewProjection * rtcWorldPos;
  output.color = instance.color;
  output.worldPos = (rtcWorldPos.xyz / rtcWorldPos.w) + rtcTile.center.xyz;
  output.clippable = instance.flags.x;
  output.rtcPos = rtcWorldPos.xyz / rtcWorldPos.w;
  output.shadowPos = shadow.lightViewProjections[0] * (shadow.cameraView * vec4<f32>(output.worldPos, 1.0));
  output.uv = input.uv;
  output.material0 = input.material0;
  output.material1 = input.material1;
  output.normal = vec4<f32>(0.0, 0.0, 0.0, input.normal.w);
  if (input.normal.w > 0.5) {
    output.normal = vec4<f32>(normalize(vec3<f32>(
      dot(instance.normalMatrix0.xyz, input.normal.xyz),
      dot(instance.normalMatrix1.xyz, input.normal.xyz),
      dot(instance.normalMatrix2.xyz, input.normal.xyz)
    )), 1.0);
  }
${triangleLogDepthVertexWrite(logDepth)}
  return output;
}

${triangleLogDepthFragmentOutputStruct(logDepth, true)}

fn getCascadeSplit(index: i32) -> f32 {
  if (index == 0) {
    return shadow.cascadeSplits0.x;
  }
  if (index == 1) {
    return shadow.cascadeSplits0.y;
  }
  if (index == 2) {
    return shadow.cascadeSplits0.z;
  }
  if (index == 3) {
    return shadow.cascadeSplits0.w;
  }
  if (index == 4) {
    return shadow.cascadeSplits1.x;
  }
  return shadow.cascadeSplits1.y;
}

fn selectShadowCascade(viewZ: f32) -> i32 {
  let cascadeCount = i32(clamp(shadow.debug.y, 1.0, 6.0));
  var cascade = 0;
  for (var i = 0; i < 5; i = i + 1) {
    if (i < cascadeCount - 1 && viewZ > getCascadeSplit(i)) {
      cascade = cascade + 1;
    }
  }
  return cascade;
}

fn sampleShadow(input: VertexOutput, normal: vec3<f32>) -> f32 {
  if (shadow.params.x < 0.5) {
    return 1.0;
  }
  let viewPos = shadow.cameraView * vec4<f32>(input.worldPos, 1.0);
  let cascade = selectShadowCascade(-viewPos.z);
  let viewNormal = normalize((shadow.cameraView * vec4<f32>(normal, 0.0)).xyz);
  var shadowClip = shadow.lightViewProjections[cascade] * viewPos;
  if (shadow.params.w > 0.0) {
    let shadowOffset = shadow.lightViewProjections[cascade] * vec4<f32>(viewNormal * shadow.params.w, 0.0);
    shadowClip = shadowClip + shadowOffset;
  }
  let shadowNdc = shadowClip.xyz / shadowClip.w;
  let shadowUV = vec2<f32>(shadowNdc.x * 0.5 + 0.5, 0.5 - shadowNdc.y * 0.5);
  if (
    shadowUV.x <= 0.0 || shadowUV.x >= 1.0 ||
    shadowUV.y <= 0.0 || shadowUV.y >= 1.0 ||
    shadowNdc.z <= 0.0 || shadowNdc.z >= 1.0
  ) {
    return 1.0;
  }
  let dims = vec2<f32>(textureDimensions(shadowMap));
  let texel = 1.0 / max(dims, vec2<f32>(1.0, 1.0));
  let lightDirView = normalize((shadow.cameraView * vec4<f32>(shadow.lightDirection.xyz, 0.0)).xyz);
  let cosTheta = clamp(dot(viewNormal, -lightDirView), 0.001, 1.0);
  let slopeFactor = min(sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / cosTheta, 10.0);
  let slopeBias = shadow.lightDirection.w * slopeFactor;
  let refDepth = shadowNdc.z - shadow.params.z - slopeBias;
  if (shadow.params.w == 0.0 && shadow.lightDirection.w == 0.0) {
    let hardLit = textureSampleCompareLevel(shadowMap, shadowSampler, shadowUV, cascade, refDepth);
    return 1.0 - (1.0 - hardLit) * shadow.params.y;
  }
  var lit = 0.0;
  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let offset = vec2<f32>(f32(x), f32(y)) * texel;
      lit += textureSampleCompareLevel(shadowMap, shadowSampler, shadowUV + offset, cascade, refDepth);
    }
  }
  let visibility = lit / 9.0;
  return 1.0 - (1.0 - visibility) * shadow.params.y;
}

const PI = 3.141592653589793;

fn distributionGGX(nDotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let denom = max((nDotH * nDotH) * (a2 - 1.0) + 1.0, 0.0001);
  return a2 / max(PI * denom * denom, 0.0001);
}

fn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return nDotV / max(nDotV * (1.0 - k) + k, 0.0001);
}

fn geometrySmith(nDotV: f32, nDotL: f32, roughness: f32) -> f32 {
  return geometrySchlickGGX(nDotV, roughness) * geometrySchlickGGX(nDotL, roughness);
}

fn fresnelSchlick(cosTheta: f32, f0: vec3<f32>) -> vec3<f32> {
  return f0 + (vec3<f32>(1.0) - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn viewToWorldDirection(dir: vec3<f32>) -> vec3<f32> {
  return normalize(
    ibl.viewToWorld0.xyz * dir.x +
    ibl.viewToWorld1.xyz * dir.y +
    ibl.viewToWorld2.xyz * dir.z
  );
}

fn triplanarWeights(normal: vec3<f32>) -> vec3<f32> {
  let w = pow(abs(normal), vec3<f32>(4.0));
  let sum = max(w.x + w.y + w.z, 0.0001);
  return w / sum;
}

fn sampleColorTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32) -> vec4<f32> {
  let p = worldPos / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  let xSample = textureSampleLevel(colorTexture, colorSampler, fract(vec2<f32>(p.y, -p.z)), 0.0);
  let ySample = textureSampleLevel(colorTexture, colorSampler, fract(vec2<f32>(p.x, -p.z)), 0.0);
  let zSample = textureSampleLevel(colorTexture, colorSampler, fract(vec2<f32>(p.x, -p.y)), 0.0);
  return xSample * w.x + ySample * w.y + zSample * w.z;
}

fn sampleMetallicRoughnessTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32) -> vec4<f32> {
  let p = worldPos / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  let xSample = textureSampleLevel(metallicRoughnessTexture, metallicRoughnessSampler, fract(vec2<f32>(p.y, -p.z)), 0.0);
  let ySample = textureSampleLevel(metallicRoughnessTexture, metallicRoughnessSampler, fract(vec2<f32>(p.x, -p.z)), 0.0);
  let zSample = textureSampleLevel(metallicRoughnessTexture, metallicRoughnessSampler, fract(vec2<f32>(p.x, -p.y)), 0.0);
  return xSample * w.x + ySample * w.y + zSample * w.z;
}

fn sampleEmissiveTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32) -> vec4<f32> {
  let p = worldPos / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  let xSample = textureSampleLevel(emissiveTexture, emissiveSampler, fract(vec2<f32>(p.y, -p.z)), 0.0);
  let ySample = textureSampleLevel(emissiveTexture, emissiveSampler, fract(vec2<f32>(p.x, -p.z)), 0.0);
  let zSample = textureSampleLevel(emissiveTexture, emissiveSampler, fract(vec2<f32>(p.x, -p.y)), 0.0);
  return xSample * w.x + ySample * w.y + zSample * w.z;
}

fn sampleOcclusionTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32) -> vec4<f32> {
  let p = worldPos / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  let xSample = textureSampleLevel(occlusionTexture, occlusionSampler, fract(vec2<f32>(p.y, -p.z)), 0.0);
  let ySample = textureSampleLevel(occlusionTexture, occlusionSampler, fract(vec2<f32>(p.x, -p.z)), 0.0);
  let zSample = textureSampleLevel(occlusionTexture, occlusionSampler, fract(vec2<f32>(p.x, -p.y)), 0.0);
  return xSample * w.x + ySample * w.y + zSample * w.z;
}

fn perturbNormalTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32) -> vec3<f32> {
  let p = worldPos / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  // Use the same projection coordinates as the albedo map above. The
  // signed world-axis mapping below accounts for each projection's
  // tangent directions, so the bump features stay registered to color.
  let xUV = vec2<f32>(p.y, -p.z);
  let yUV = vec2<f32>(p.x, -p.z);
  let zUV = vec2<f32>(p.x, -p.y);
  var nmX = textureSampleLevel(normalTexture, normalSampler, fract(xUV), 0.0).xyz * 2.0 - 1.0;
  var nmY = textureSampleLevel(normalTexture, normalSampler, fract(yUV), 0.0).xyz * 2.0 - 1.0;
  var nmZ = textureSampleLevel(normalTexture, normalSampler, fract(zUV), 0.0).xyz * 2.0 - 1.0;
  let nmWorld = vec3<f32>(0.0, nmX.x, -nmX.y) * w.x +
    vec3<f32>(nmY.x, 0.0, -nmY.y) * w.y +
    vec3<f32>(nmZ.x, -nmZ.y, 0.0) * w.z;
  return normalize(normal + nmWorld);
}

fn perturbNormal(input: VertexOutput, normal: vec3<f32>, uv: vec2<f32>) -> vec3<f32> {
  let tangentSampleRaw = textureSampleLevel(normalTexture, normalSampler, uv, 0.0).xyz * 2.0 - 1.0;
  let tangentSample = vec3<f32>(tangentSampleRaw.x, -tangentSampleRaw.y, tangentSampleRaw.z);
  // Match WebGLRenderer: build the tangent frame in view space from the
  // same position and normal derivatives used by its UV path. Returning
  // the result in world space keeps the WebGPU lighting path unchanged.
  let viewNormal = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz);
  let viewPos = (frame.viewMatrix * vec4<f32>(input.rtcPos, 1.0)).xyz;
  let dp1 = dpdx(viewPos);
  let dp2 = dpdy(viewPos);
  let duv1 = dpdx(input.uv);
  let duv2 = dpdy(input.uv);
  let dp2perp = cross(dp2, viewNormal);
  let dp1perp = cross(viewNormal, dp1);
  let tangent = dp2perp * duv1.x + dp1perp * duv2.x;
  let bitangent = dp2perp * duv1.y + dp1perp * duv2.y;
  let invMax = inverseSqrt(max(max(dot(tangent, tangent), dot(bitangent, bitangent)), 1e-10));
  let tbn = mat3x3<f32>(tangent * invMax, bitangent * invMax, viewNormal);
  let perturbedViewNormal = normalize(tbn * tangentSample);
  let viewRotation = mat3x3<f32>(
    frame.viewMatrix[0].xyz,
    frame.viewMatrix[1].xyz,
    frame.viewMatrix[2].xyz
  );
  return normalize(transpose(viewRotation) * perturbedViewNormal);
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> ${triangleLogDepthReturnType(logDepth, true)} {
  let dpdxRTC = dpdx(input.rtcPos);
  let dpdyRTC = dpdy(input.rtcPos);
  var faceNormal = normalize(cross(dpdyRTC, dpdxRTC));
  let faceNormalView = normalize((frame.viewMatrix * vec4<f32>(faceNormal, 0.0)).xyz);
  let viewPosForIBL = (frame.viewMatrix * vec4<f32>(input.worldPos, 1.0)).xyz;
  let viewDirView = normalize(-viewPosForIBL);
  if (dot(faceNormalView, viewDirView) < 0.0) {
    faceNormal = -faceNormal;
  }
  var normal = faceNormal;
  if (input.normal.w > 0.5) {
    normal = normalize(input.normal.xyz);
    let normalView = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz);
    if (dot(normalView, viewPosForIBL) > 0.0) {
      normal = -normal;
    }
  }
  let uv = fract(input.uv);
  let textureMode = input.material1.w;
  let triplanarScale = max(textureMode, 0.0);
  let useUVTextures = textureMode < 0.0;
  let useTriplanar = textureMode > 0.0;
  let uvNormal = perturbNormal(input, normal, uv);
  normal = select(normal, uvNormal, useUVTextures);
  if (useTriplanar) {
    normal = perturbNormalTriplanar(input.worldPos, normal, triplanarScale);
  }
  if (input.clippable > 0.5) {
    for (var i = 0u; i < 8u; i = i + 1u) {
      if (i >= u32(frame.sectionPlaneState.x)) {
        break;
      }
      let plane = frame.sectionPlanes[i];
      if (dot(plane.xyz, input.worldPos) + plane.w > 0.0) {
        discard;
      }
    }
  }
  let worldNormal = normalize(normal);
  var baseColorSample: vec4<f32>;
  if (useTriplanar) {
    baseColorSample = sampleColorTriplanar(input.worldPos, worldNormal, triplanarScale);
  } else {
    baseColorSample = textureSampleLevel(colorTexture, colorSampler, uv, 0.0);
  }
  let alpha = input.color.a * baseColorSample.a;
  if (input.material1.y > 0.5 && input.material1.y < 1.5 && alpha < input.material1.z) {
    discard;
  }
  let baseColor = input.color.rgb * baseColorSample.rgb;
  var mrSample: vec4<f32>;
  if (useTriplanar) {
    mrSample = sampleMetallicRoughnessTriplanar(input.worldPos, worldNormal, triplanarScale);
  } else {
    mrSample = textureSampleLevel(metallicRoughnessTexture, metallicRoughnessSampler, uv, 0.0);
  }
  let roughness = clamp(input.material0.x * mrSample.g, 0.045, 1.0);
  let metallic = clamp(input.material0.y * mrSample.b, 0.0, 1.0);
  var emissiveSample: vec4<f32>;
  if (useTriplanar) {
    emissiveSample = sampleEmissiveTriplanar(input.worldPos, worldNormal, triplanarScale);
  } else {
    emissiveSample = textureSampleLevel(emissiveTexture, emissiveSampler, uv, 0.0);
  }
  let emissive = emissiveSample.rgb * vec3<f32>(input.material0.z, input.material0.w, input.material1.x);
  var aoSample: vec4<f32>;
  if (useTriplanar) {
    aoSample = sampleOcclusionTriplanar(input.worldPos, worldNormal, triplanarScale);
  } else {
    aoSample = textureSampleLevel(occlusionTexture, occlusionSampler, uv, 0.0);
  }
  let ao = aoSample.r;
  let viewNormal = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz);
  let iblIntensity = max(ibl.params.x, 0.0);
  let ambientScale = mix(1.0, 0.75, clamp(iblIntensity, 0.0, 1.0));
  let flatAmbientColor = frame.ambientLight.rgb * frame.ambientLight.a * ambientScale * baseColor * ao;
  let hemisphereFacing = clamp(dot(worldNormal, normalize(frame.hemisphereUp.xyz)) * 0.5 + 0.5, 0.0, 1.0);
  let hemisphereAmbient = mix(frame.hemisphereGround.rgb, frame.hemisphereSky.rgb, hemisphereFacing);
  let hemisphereColor = hemisphereAmbient * max(frame.hemisphereSky.a, 0.0) * baseColor * ao;
  let ambientColor = flatAmbientColor + hemisphereColor;
  let shadowFactor = sampleShadow(input, normal);
  if (shadow.debug.x > 1.5) {
    let viewPos = shadow.cameraView * vec4<f32>(input.worldPos, 1.0);
    let cascade = selectShadowCascade(-viewPos.z);
    let shadowClip = shadow.lightViewProjections[cascade] * viewPos;
    let shadowNdc = shadowClip.xyz / shadowClip.w;
    let shadowUV = vec2<f32>(shadowNdc.x * 0.5 + 0.5, 0.5 - shadowNdc.y * 0.5);
    if (
      shadowUV.x <= 0.0 || shadowUV.x >= 1.0 ||
      shadowUV.y <= 0.0 || shadowUV.y >= 1.0
    ) {
      return ${triangleLogDepthReturn(logDepth, "vec4<f32>(0.0, 0.0, 1.0, input.color.a)")};
    }
    let dims = vec2<i32>(textureDimensions(shadowMap));
    let texelCoord = clamp(vec2<i32>(shadowUV * vec2<f32>(dims)), vec2<i32>(0, 0), dims - vec2<i32>(1, 1));
    let rawDepth = textureLoad(shadowMap, texelCoord, cascade, 0);
    return ${triangleLogDepthReturn(logDepth, "vec4<f32>(vec3<f32>(rawDepth), input.color.a)")};
  }
  if (shadow.debug.x > 0.5) {
    return ${triangleLogDepthReturn(logDepth, "vec4<f32>(vec3<f32>(shadowFactor), input.color.a)")};
  }
  let f0 = mix(vec3<f32>(0.04, 0.04, 0.04), baseColor, vec3<f32>(metallic));
  var directColor = vec3<f32>(0.0, 0.0, 0.0);
  for (var i = 0u; i < 3u; i = i + 1u) {
    let lightDir = normalize((frame.viewMatrix * vec4<f32>(frame.dirLightDirections[i].xyz, 0.0)).xyz);
    let lightColor = frame.dirLightColors[i];
    let l = normalize(-lightDir);
    let halfDir = normalize(viewDirView + l);
    let nDotL = max(dot(viewNormal, l), 0.0);
    let nDotV = max(dot(viewNormal, viewDirView), 0.001);
    let nDotH = max(dot(viewNormal, halfDir), 0.0);
    let hDotV = max(dot(halfDir, viewDirView), 0.0);
    let d = distributionGGX(nDotH, roughness);
    let g = geometrySmith(nDotV, nDotL, roughness);
    let f = fresnelSchlick(hDotV, f0);
    let numerator = d * g * f;
    let specular = numerator / max(4.0 * nDotV * nDotL, 0.0001);
    let kd = (vec3<f32>(1.0) - f) * (1.0 - metallic);
    let diffuse = kd * baseColor / PI;
    directColor += (diffuse + specular) * lightColor.rgb * lightColor.a * nDotL;
  }
  let worldViewDir = viewToWorldDirection(viewDirView);
  let worldReflection = reflect(-worldViewDir, worldNormal);
  let iblDiffuseEnv = textureSampleLevel(iblIrradianceCubemap, iblSampler, worldNormal, 0.0).rgb;
  let specMip = roughness * ibl.params.y;
  let iblSpecEnv = textureSampleLevel(iblPrefilteredCubemap, iblSampler, worldReflection, specMip).rgb;
  let nDotVIBL = max(dot(viewNormal, viewDirView), 0.0);
  let fNV = fresnelSchlick(nDotVIBL, f0);
  let brdfLUT = textureSampleLevel(iblBRDFLUT, iblSampler, vec2<f32>(nDotVIBL, roughness), 0.0).rg;
  let iblSpec = iblSpecEnv * (f0 * brdfLUT.x + brdfLUT.y);
  let iblDiff = (vec3<f32>(1.0) - fNV) * (1.0 - metallic) * iblDiffuseEnv * baseColor;
  let iblColor = (iblDiff + iblSpec) * iblIntensity * ao;
  let litColor = ambientColor + iblColor + directColor * shadowFactor + emissive;
  return ${triangleLogDepthReturn(logDepth, "vec4<f32>(litColor * alpha, alpha)")};
}
`;
}

/**
 * @internal
 */
export const TRIANGLES_DRAW_COLOR_SHADER = createTrianglesDrawColorShader(false);
