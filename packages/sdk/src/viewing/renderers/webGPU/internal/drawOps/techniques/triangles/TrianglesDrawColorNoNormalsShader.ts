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
 * WGSL shader for no-normal triangle surface rendering.
 *
 * Mirrors WebGL's no-normal triangle policy: derivative face normals, Lambert
 * direct lighting, analytical ambient terms and shadow floor, with no PBR IBL.
 *
 * @internal
 */
export function createTrianglesDrawColorNoNormalsShader(logDepth = false): string {
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
${triangleLogDepthVertexField(logDepth, 7)}
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
${triangleLogDepthVertexWrite(logDepth)}
  return output;
}

${triangleLogDepthFragmentOutputStruct(logDepth, true)}

${TRIANGLES_SHADOW_SAMPLING_WGSL}

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

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> ${triangleLogDepthReturnType(logDepth, true)} {
  let dpdxRTC = dpdx(input.rtcPos);
  let dpdyRTC = dpdy(input.rtcPos);
  let dpdxWorld = dpdx(input.worldPos);
  let dpdyWorld = dpdy(input.worldPos);
  let uvDx = dpdx(input.uv);
  let uvDy = dpdy(input.uv);
  var normal = normalize(cross(dpdyRTC, dpdxRTC));
  let normalView = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz);
  let viewPos = (frame.viewMatrix * vec4<f32>(input.worldPos, 1.0)).xyz;
  let viewDir = normalize(-viewPos);
  if (dot(normalView, viewDir) < 0.0) {
    normal = -normal;
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
  let uv = input.uv;
  let textureMode = input.material1.w;
  let useUVTexture = textureMode < -0.5;
  let useTriplanar = textureMode > 0.0;
  var baseColorSample = vec4<f32>(1.0, 1.0, 1.0, 1.0);
  if (useTriplanar) {
    let triplanarScale = textureMode;
    baseColorSample = sampleColorTriplanar(input.worldPos, worldNormal, triplanarScale, dpdxWorld, dpdyWorld);
  } else if (useUVTexture) {
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

  var emissiveSample = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  if (useTriplanar) {
    let triplanarScale = textureMode;
    emissiveSample = sampleEmissiveTriplanar(input.worldPos, worldNormal, triplanarScale, dpdxWorld, dpdyWorld);
  } else if (useUVTexture) {
    emissiveSample = textureSampleGrad(emissiveTexture, emissiveSampler, uv, mipDx(uvDx), mipDy(uvDy));
  }
  let emissive = emissiveSample.rgb * vec3<f32>(input.material0.z, input.material0.w, input.material1.x);

  var aoSample = vec4<f32>(1.0, 1.0, 1.0, 1.0);
  if (useTriplanar) {
    let triplanarScale = textureMode;
    aoSample = sampleOcclusionTriplanar(input.worldPos, worldNormal, triplanarScale, dpdxWorld, dpdyWorld);
  } else if (useUVTexture) {
    aoSample = textureSampleGrad(occlusionTexture, occlusionSampler, uv, mipDx(uvDx), mipDy(uvDy));
  }
  let ao = aoSample.r;

  let viewNormal = normalize((frame.viewMatrix * vec4<f32>(normal, 0.0)).xyz);
  let flatAmbientColor = frame.ambientLight.rgb * frame.ambientLight.a * baseColor * ao;
  let hemisphereFacing = clamp(dot(worldNormal, normalize(frame.hemisphereUp.xyz)) * 0.5 + 0.5, 0.0, 1.0);
  let hemisphereAmbient = mix(frame.hemisphereGround.rgb, frame.hemisphereSky.rgb, hemisphereFacing);
  let hemisphereColor = hemisphereAmbient * max(frame.hemisphereSky.a, 0.0) * baseColor * ao;
  let ambientColor = flatAmbientColor + hemisphereColor;

  let shadowSample = sampleShadow(input, normal);
  let shadowFactor = shadowSample.factor;
  let lightDirWorld = frame.dirLightDirections[0].xyz;
  let lightDir = normalize((frame.viewMatrix * vec4<f32>(lightDirWorld, 0.0)).xyz);
  let lightColor = frame.dirLightColors[0];
  let lambertian = max(dot(viewNormal, normalize(-lightDir)), 0.0);
  let directColor = baseColor * lightColor.rgb * lightColor.a * lambertian;

  if (shadow.debug.x > 0.5) {
    return ${triangleLogDepthReturn(logDepth, "debugShadowSampleColor(shadowSample, input.color.a)")};
  }

  let unshadowedColor = ambientColor + directColor + emissive;
  let ambientFloor = ambientColor + emissive;
  let shadowFloor = ambientFloor;
  let litColor = max(unshadowedColor * shadowFactor, shadowFloor);
  return ${triangleLogDepthReturn(logDepth, "vec4<f32>(litColor * alpha, alpha)")};
}
`;
}
