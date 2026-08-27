import {TRIANGLE_POSITION_DECODE_WGSL, TRIANGLE_RTC_TILE_WGSL} from "./TrianglePositionPacking";
import {
  triangleLogDepthFragmentOutputStruct,
  triangleLogDepthReturn,
  triangleLogDepthReturnType,
  triangleLogDepthVertexField,
  triangleLogDepthVertexWrite
} from "./TriangleLogDepth";
import {TRIANGLES_SHADOW_SAMPLING_WGSL} from "./TrianglesShadowSampling";

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
  soft: vec4<f32>,
  cascadeDepthRanges0: vec4<f32>,
  cascadeDepthRanges1: vec4<f32>,
  cascadeTexelSizes0: vec4<f32>,
  cascadeTexelSizes1: vec4<f32>,
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
  @location(6) vertexColor: vec4<f32>,
  @location(8) material2: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) worldPos: vec3<f32>,
  @location(2) clippable: f32,
  @location(3) rtcPos: vec3<f32>,
  @location(4) uv: vec2<f32>,
  @location(5) material0: vec4<f32>,
  @location(6) material1: vec4<f32>,
  @location(7) normal: vec4<f32>,
  @location(8) material2: vec4<f32>,
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
  output.color = instance.color * input.vertexColor;
  output.worldPos = (rtcWorldPos.xyz / rtcWorldPos.w) + rtcTile.center.xyz;
  output.clippable = instance.flags.x;
  output.rtcPos = rtcWorldPos.xyz / rtcWorldPos.w;
  output.uv = input.uv;
  output.material0 = input.material0;
  output.material1 = input.material1;
  output.material2 = input.material2;
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

${TRIANGLES_SHADOW_SAMPLING_WGSL}

const PI = 3.141592653589793;

fn distributionGGX(nDotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let denom = (nDotH * a2 - nDotH) * nDotH + 1.0;
  return a2 / max(PI * denom * denom, 1e-6);
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

fn fresnelSchlickRoughness(cosTheta: f32, f0: vec3<f32>, roughness: f32) -> vec3<f32> {
  return f0 + (max(vec3<f32>(1.0 - roughness), f0) - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn specularOcclusion(nDotV: f32, ao: f32, roughness: f32) -> f32 {
  return clamp(pow(nDotV + ao, exp2(-16.0 * roughness - 1.0)) - 1.0 + ao, 0.0, 1.0);
}

fn fresnelSchlickScalar(cosTheta: f32, f0: f32) -> f32 {
  return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
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

fn mipDx(dx: vec2<f32>) -> vec2<f32> {
  return dx;
}

fn mipDy(dy: vec2<f32>) -> vec2<f32> {
  return dy;
}

fn triplanarUVX(p: vec3<f32>, normal: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(select(p.z, -p.z, normal.x < 0.0), p.y);
}

fn triplanarUVY(p: vec3<f32>, normal: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(p.x, select(p.z, -p.z, normal.y < 0.0));
}

fn triplanarUVZ(p: vec3<f32>, normal: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(select(p.x, -p.x, normal.z < 0.0), p.y);
}

fn triplanarDxX(dp: vec3<f32>, normal: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(select(dp.z, -dp.z, normal.x < 0.0), dp.y);
}

fn triplanarDxY(dp: vec3<f32>, normal: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(dp.x, select(dp.z, -dp.z, normal.y < 0.0));
}

fn triplanarDxZ(dp: vec3<f32>, normal: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(select(dp.x, -dp.x, normal.z < 0.0), dp.y);
}

fn sampleColorTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32, dpdxWorld: vec3<f32>, dpdyWorld: vec3<f32>) -> vec4<f32> {
  let p = worldPos / max(scale, 0.0001);
  let dpdxP = dpdxWorld / max(scale, 0.0001);
  let dpdyP = dpdyWorld / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  let xSample = textureSampleGrad(colorTexture, colorSampler, triplanarUVX(p, normal), mipDx(triplanarDxX(dpdxP, normal)), mipDy(triplanarDxX(dpdyP, normal)));
  let ySample = textureSampleGrad(colorTexture, colorSampler, triplanarUVY(p, normal), mipDx(triplanarDxY(dpdxP, normal)), mipDy(triplanarDxY(dpdyP, normal)));
  let zSample = textureSampleGrad(colorTexture, colorSampler, triplanarUVZ(p, normal), mipDx(triplanarDxZ(dpdxP, normal)), mipDy(triplanarDxZ(dpdyP, normal)));
  return xSample * w.x + ySample * w.y + zSample * w.z;
}

fn sampleMetallicRoughnessTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32, dpdxWorld: vec3<f32>, dpdyWorld: vec3<f32>) -> vec4<f32> {
  let p = worldPos / max(scale, 0.0001);
  let dpdxP = dpdxWorld / max(scale, 0.0001);
  let dpdyP = dpdyWorld / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  let xSample = textureSampleGrad(metallicRoughnessTexture, metallicRoughnessSampler, triplanarUVX(p, normal), mipDx(triplanarDxX(dpdxP, normal)), mipDy(triplanarDxX(dpdyP, normal)));
  let ySample = textureSampleGrad(metallicRoughnessTexture, metallicRoughnessSampler, triplanarUVY(p, normal), mipDx(triplanarDxY(dpdxP, normal)), mipDy(triplanarDxY(dpdyP, normal)));
  let zSample = textureSampleGrad(metallicRoughnessTexture, metallicRoughnessSampler, triplanarUVZ(p, normal), mipDx(triplanarDxZ(dpdxP, normal)), mipDy(triplanarDxZ(dpdyP, normal)));
  return xSample * w.x + ySample * w.y + zSample * w.z;
}

fn sampleEmissiveTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32, dpdxWorld: vec3<f32>, dpdyWorld: vec3<f32>) -> vec4<f32> {
  let p = worldPos / max(scale, 0.0001);
  let dpdxP = dpdxWorld / max(scale, 0.0001);
  let dpdyP = dpdyWorld / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  let xSample = textureSampleGrad(emissiveTexture, emissiveSampler, triplanarUVX(p, normal), mipDx(triplanarDxX(dpdxP, normal)), mipDy(triplanarDxX(dpdyP, normal)));
  let ySample = textureSampleGrad(emissiveTexture, emissiveSampler, triplanarUVY(p, normal), mipDx(triplanarDxY(dpdxP, normal)), mipDy(triplanarDxY(dpdyP, normal)));
  let zSample = textureSampleGrad(emissiveTexture, emissiveSampler, triplanarUVZ(p, normal), mipDx(triplanarDxZ(dpdxP, normal)), mipDy(triplanarDxZ(dpdyP, normal)));
  return xSample * w.x + ySample * w.y + zSample * w.z;
}

fn sampleOcclusionTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32, dpdxWorld: vec3<f32>, dpdyWorld: vec3<f32>) -> vec4<f32> {
  let p = worldPos / max(scale, 0.0001);
  let dpdxP = dpdxWorld / max(scale, 0.0001);
  let dpdyP = dpdyWorld / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  let xSample = textureSampleGrad(occlusionTexture, occlusionSampler, triplanarUVX(p, normal), mipDx(triplanarDxX(dpdxP, normal)), mipDy(triplanarDxX(dpdyP, normal)));
  let ySample = textureSampleGrad(occlusionTexture, occlusionSampler, triplanarUVY(p, normal), mipDx(triplanarDxY(dpdxP, normal)), mipDy(triplanarDxY(dpdyP, normal)));
  let zSample = textureSampleGrad(occlusionTexture, occlusionSampler, triplanarUVZ(p, normal), mipDx(triplanarDxZ(dpdxP, normal)), mipDy(triplanarDxZ(dpdyP, normal)));
  return xSample * w.x + ySample * w.y + zSample * w.z;
}

fn perturbNormalTriplanar(worldPos: vec3<f32>, normal: vec3<f32>, scale: f32, dpdxWorld: vec3<f32>, dpdyWorld: vec3<f32>) -> vec3<f32> {
  let p = worldPos / max(scale, 0.0001);
  let dpdxP = dpdxWorld / max(scale, 0.0001);
  let dpdyP = dpdyWorld / max(scale, 0.0001);
  let w = triplanarWeights(normal);
  // Use the same projection coordinates as the albedo map above. The
  // signed world-axis mapping below accounts for each projection's
  // tangent directions, so the bump features stay registered to color.
  let xUV = triplanarUVX(p, normal);
  let yUV = triplanarUVY(p, normal);
  let zUV = triplanarUVZ(p, normal);
  var nmX = textureSampleGrad(normalTexture, normalSampler, xUV, mipDx(triplanarDxX(dpdxP, normal)), mipDy(triplanarDxX(dpdyP, normal))).xyz * 2.0 - 1.0;
  var nmY = textureSampleGrad(normalTexture, normalSampler, yUV, mipDx(triplanarDxY(dpdxP, normal)), mipDy(triplanarDxY(dpdyP, normal))).xyz * 2.0 - 1.0;
  var nmZ = textureSampleGrad(normalTexture, normalSampler, zUV, mipDx(triplanarDxZ(dpdxP, normal)), mipDy(triplanarDxZ(dpdyP, normal))).xyz * 2.0 - 1.0;
  nmX.x = select(nmX.x, -nmX.x, normal.x < 0.0);
  nmY.x = select(nmY.x, -nmY.x, normal.y < 0.0);
  nmZ.x = select(nmZ.x, -nmZ.x, normal.z < 0.0);
  let nmWorld = vec3<f32>(0.0, nmX.y, nmX.x) * w.x +
    vec3<f32>(nmY.x, 0.0, nmY.y) * w.y +
    vec3<f32>(nmZ.x, nmZ.y, 0.0) * w.z;
  return normalize(normal + nmWorld);
}

fn viewToWorldNormal(dir: vec3<f32>) -> vec3<f32> {
  let viewRotation = mat3x3<f32>(
    frame.viewMatrix[0].xyz,
    frame.viewMatrix[1].xyz,
    frame.viewMatrix[2].xyz
  );
  return normalize(transpose(viewRotation) * dir);
}

fn perturbNormalView(normal: vec3<f32>, uv: vec2<f32>, uvDx: vec2<f32>, uvDy: vec2<f32>, dp1: vec3<f32>, dp2: vec3<f32>, duv1: vec2<f32>, duv2: vec2<f32>) -> vec3<f32> {
  let tangentSampleRaw = textureSampleGrad(normalTexture, normalSampler, uv, mipDx(uvDx), mipDy(uvDy)).xyz * 2.0 - 1.0;
  let tangentSample = vec3<f32>(tangentSampleRaw.x, -tangentSampleRaw.y, tangentSampleRaw.z);
  // Match WebGLRenderer: build the tangent frame in view space from the
  // same position and normal derivatives used by its UV path.
  let viewNormal = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz);
  let dp2perp = cross(dp2, viewNormal);
  let dp1perp = cross(viewNormal, dp1);
  let tangent = dp2perp * duv1.x + dp1perp * duv2.x;
  let bitangent = dp2perp * duv1.y + dp1perp * duv2.y;
  let invMax = inverseSqrt(max(max(dot(tangent, tangent), dot(bitangent, bitangent)), 1e-10));
  let tbn = mat3x3<f32>(tangent * invMax, bitangent * invMax, viewNormal);
  let perturbedViewNormal = normalize(tbn * tangentSample);
  return perturbedViewNormal;
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> ${triangleLogDepthReturnType(logDepth, true)} {
  let dpdxRTC = dpdx(input.rtcPos);
  let dpdyRTC = dpdy(input.rtcPos);
  let dpdxWorld = dpdx(input.worldPos);
  let dpdyWorld = dpdy(input.worldPos);
  let uvDx = dpdx(input.uv);
  let uvDy = dpdy(input.uv);
  let tbnViewPos = (frame.viewMatrix * vec4<f32>(input.rtcPos, 1.0)).xyz;
  let tbnDp1 = dpdx(tbnViewPos);
  let tbnDp2 = dpdy(tbnViewPos);
  let tbnDuv1 = dpdx(input.uv);
  let tbnDuv2 = dpdy(input.uv);
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
  let shadowBiasNormal = normalize(normal);
  let uv = input.uv;
  let textureMode = input.material1.w;
  let triplanarScale = max(textureMode, 0.0);
  let useUVTextures = textureMode < 0.0;
  let useTriplanar = textureMode > 0.0;
  var viewNormal = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz);
  if (useUVTextures) {
    viewNormal = perturbNormalView(normal, uv, uvDx, uvDy, tbnDp1, tbnDp2, tbnDuv1, tbnDuv2);
    if (dot(viewNormal, viewPosForIBL) > 0.0) {
      viewNormal = -viewNormal;
    }
    normal = viewToWorldNormal(viewNormal);
  }
  if (useTriplanar) {
    normal = perturbNormalTriplanar(input.worldPos, normal, triplanarScale, dpdxWorld, dpdyWorld);
    viewNormal = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz);
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
    baseColorSample = sampleColorTriplanar(input.worldPos, worldNormal, triplanarScale, dpdxWorld, dpdyWorld);
  } else {
    baseColorSample = textureSampleGrad(colorTexture, colorSampler, uv, mipDx(uvDx), mipDy(uvDy));
  }
  let sampledAlpha = input.color.a * baseColorSample.a;
  let sampledAlphaWidth = max(fwidth(sampledAlpha), 0.0001);
  if (input.material1.y > 0.5 && input.material1.y < 1.5) {
    // Reject the bilinear transition band so masked foliage does not shade
    // RGB from source texels authored only as transparent padding.
    let aaAlpha = (sampledAlpha - input.material1.z) / sampledAlphaWidth + 0.5;
    if (aaAlpha < 1.0) {
      discard;
    }
  }
  let alpha = select(input.color.a, sampledAlpha, input.material1.y > 1.5);
  let baseColor = input.color.rgb * baseColorSample.rgb;
  var mrSample: vec4<f32>;
  if (useTriplanar) {
    mrSample = sampleMetallicRoughnessTriplanar(input.worldPos, worldNormal, triplanarScale, dpdxWorld, dpdyWorld);
  } else {
    mrSample = textureSampleGrad(metallicRoughnessTexture, metallicRoughnessSampler, uv, mipDx(uvDx), mipDy(uvDy));
  }
  let roughness = clamp(input.material0.x * mrSample.g, 0.045, 1.0);
  let metallic = clamp(input.material0.y * mrSample.b, 0.0, 1.0);
  let clearcoat = clamp(input.material2.x, 0.0, 1.0);
  let clearcoatRoughness = clamp(input.material2.y, 0.045, 1.0);
  let sheen = clamp(input.material2.z, 0.0, 1.0);
  let sheenRoughness = clamp(input.material2.w, 0.045, 1.0);
  var emissiveSample: vec4<f32>;
  if (useTriplanar) {
    emissiveSample = sampleEmissiveTriplanar(input.worldPos, worldNormal, triplanarScale, dpdxWorld, dpdyWorld);
  } else {
    emissiveSample = textureSampleGrad(emissiveTexture, emissiveSampler, uv, mipDx(uvDx), mipDy(uvDy));
  }
  let emissive = emissiveSample.rgb * vec3<f32>(input.material0.z, input.material0.w, input.material1.x);
  var aoSample: vec4<f32>;
  if (useTriplanar) {
    aoSample = sampleOcclusionTriplanar(input.worldPos, worldNormal, triplanarScale, dpdxWorld, dpdyWorld);
  } else {
    aoSample = textureSampleGrad(occlusionTexture, occlusionSampler, uv, mipDx(uvDx), mipDy(uvDy));
  }
  let ao = aoSample.r;
  let iblIntensity = max(ibl.params.x, 0.0);
  let flatAmbientColor = frame.ambientLight.rgb * frame.ambientLight.a * baseColor;
  let hemisphereFacing = clamp(dot(worldNormal, normalize(frame.hemisphereUp.xyz)) * 0.5 + 0.5, 0.0, 1.0);
  let hemisphereAmbient = mix(frame.hemisphereGround.rgb, frame.hemisphereSky.rgb, hemisphereFacing);
  let hemisphereColor = hemisphereAmbient * max(frame.hemisphereSky.a, 0.0) * baseColor;
  let ambientColor = flatAmbientColor + hemisphereColor;
  let shadowSample = sampleShadow(input, shadowBiasNormal);
  let shadowFactor = shadowSample.factor;
  if (shadow.debug.x > 0.5) {
    return ${triangleLogDepthReturn(logDepth, "debugShadowSampleColor(shadowSample, input.color.a)")};
  }
  let f0 = mix(vec3<f32>(0.04, 0.04, 0.04), baseColor, vec3<f32>(metallic));
  let lightDirWorld = frame.dirLightDirections[0].xyz;
  let lightDir = normalize((frame.viewMatrix * vec4<f32>(lightDirWorld, 0.0)).xyz);
  let lightColor = frame.dirLightColors[0];
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
  let clearcoatF = fresnelSchlickScalar(hDotV, 0.04);
  let clearcoatD = distributionGGX(nDotH, clearcoatRoughness);
  let clearcoatG = geometrySmith(nDotV, nDotL, clearcoatRoughness);
  let clearcoatSpecular = clearcoat * clearcoatD * clearcoatG * clearcoatF / max(4.0 * nDotV * nDotL, 0.0001);
  let kd = (vec3<f32>(1.0) - f) * (1.0 - metallic);
  let diffuse = kd * baseColor / PI;
  let clearcoatBaseAttenuation = 1.0 - clearcoat * clearcoatF;
  let sheenExponent = mix(8.0, 2.0, sheenRoughness);
  let sheenDirect = baseColor * sheen * pow(max(1.0 - hDotV, 0.0), sheenExponent) * (1.0 - metallic);
  let directColor = ((diffuse + specular + sheenDirect) * clearcoatBaseAttenuation + vec3<f32>(clearcoatSpecular)) * lightColor.rgb * lightColor.a * nDotL;
  let worldViewDir = viewToWorldDirection(viewDirView);
  let worldReflection = reflect(-worldViewDir, worldNormal);
  let iblDiffuseEnv = textureSampleLevel(iblIrradianceCubemap, iblSampler, worldNormal, 0.0).rgb;
  let specMip = roughness * ibl.params.y;
  let iblSpecEnv = textureSampleLevel(iblPrefilteredCubemap, iblSampler, worldReflection, specMip).rgb;
  let clearcoatSpecMip = clearcoatRoughness * ibl.params.y;
  let clearcoatSpecEnv = textureSampleLevel(iblPrefilteredCubemap, iblSampler, worldReflection, clearcoatSpecMip).rgb;
  let nDotVIBL = max(dot(viewNormal, viewDirView), 0.0);
  let fNV = fresnelSchlickRoughness(nDotVIBL, f0, roughness);
  let brdfLUT = textureSampleLevel(iblBRDFLUT, iblSampler, vec2<f32>(nDotVIBL, roughness), 0.0).rg;
  let iblSpecOcclusion = specularOcclusion(nDotVIBL, ao, roughness);
  let iblSpec = iblSpecEnv * (f0 * brdfLUT.x + brdfLUT.y) * iblSpecOcclusion;
  let iblDiff = (vec3<f32>(1.0) - fNV) * (1.0 - metallic) * iblDiffuseEnv * baseColor;
  let sheenIBLWeight = sheen * pow(max(1.0 - nDotVIBL, 0.0), mix(4.0, 1.0, sheenRoughness)) * (1.0 - metallic);
  let iblSheen = iblDiffuseEnv * baseColor * sheenIBLWeight;
  let clearcoatFNV = fresnelSchlickScalar(nDotVIBL, 0.04);
  let clearcoatBRDFLUT = textureSampleLevel(iblBRDFLUT, iblSampler, vec2<f32>(nDotVIBL, clearcoatRoughness), 0.0).rg;
  let clearcoatIBLOcclusion = specularOcclusion(nDotVIBL, ao, clearcoatRoughness);
  let clearcoatIBLSpec = clearcoatSpecEnv * (0.04 * clearcoatBRDFLUT.x + clearcoatBRDFLUT.y) * clearcoat * clearcoatIBLOcclusion;
  let iblColor = ((iblDiff + iblSpec + iblSheen) * (1.0 - clearcoat * clearcoatFNV) + clearcoatIBLSpec) * iblIntensity;
  let indirectColor = ambientColor + iblColor;
  let unshadowedColor = indirectColor * ao + directColor + emissive;
  let ambientFloor = (ambientColor + iblDiff * iblIntensity) * ao + emissive;
  let indirectFloor = indirectColor * ao + emissive;
  let shadowFloor = mix(ambientFloor, indirectFloor, 0.25);
  let litColor = max(unshadowedColor * shadowFactor, shadowFloor);
  return ${triangleLogDepthReturn(logDepth, "vec4<f32>(litColor * alpha, alpha)")};
}
`;
}

/**
 * @internal
 */
export const TRIANGLES_DRAW_COLOR_SHADER = createTrianglesDrawColorShader(false);
