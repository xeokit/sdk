/**
 * Shared WGSL shadow selection, receiver bias and PCF sampling for WebGPU triangle color shaders.
 *
 * @internal
 */
export const TRIANGLES_SHADOW_SAMPLING_WGSL = `
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

fn getCascadeDepthRange(index: i32) -> f32 {
  if (index == 0) {
    return shadow.cascadeDepthRanges0.x;
  }
  if (index == 1) {
    return shadow.cascadeDepthRanges0.y;
  }
  if (index == 2) {
    return shadow.cascadeDepthRanges0.z;
  }
  if (index == 3) {
    return shadow.cascadeDepthRanges0.w;
  }
  if (index == 4) {
    return shadow.cascadeDepthRanges1.x;
  }
  return shadow.cascadeDepthRanges1.y;
}

fn getCascadeTexelWorldSize(index: i32) -> f32 {
  if (index == 0) {
    return shadow.cascadeTexelSizes0.x;
  }
  if (index == 1) {
    return shadow.cascadeTexelSizes0.y;
  }
  if (index == 2) {
    return shadow.cascadeTexelSizes0.z;
  }
  if (index == 3) {
    return shadow.cascadeTexelSizes0.w;
  }
  if (index == 4) {
    return shadow.cascadeTexelSizes1.x;
  }
  return shadow.cascadeTexelSizes1.y;
}

fn shadowCascadeDebugColor(cascade: i32) -> vec3<f32> {
  if (cascade == 0) {
    return vec3<f32>(0.95, 0.18, 0.12);
  }
  if (cascade == 1) {
    return vec3<f32>(0.15, 0.72, 0.25);
  }
  if (cascade == 2) {
    return vec3<f32>(0.15, 0.34, 0.95);
  }
  if (cascade == 3) {
    return vec3<f32>(0.95, 0.78, 0.18);
  }
  if (cascade == 4) {
    return vec3<f32>(0.72, 0.25, 0.95);
  }
  return vec3<f32>(0.12, 0.82, 0.90);
}

struct ShadowSample {
  factor: f32,
  visibility: f32,
  rawDepth: f32,
  refDepth: f32,
  totalBias: f32,
  blockerDepth: f32,
  filterRadius: f32,
  cascade: i32,
  inside: f32,
};

fn sampleShadowDepth(cascade: i32, uv: vec2<f32>) -> f32 {
  let dims = vec2<i32>(textureDimensions(shadowMap));
  let texelCoord = clamp(vec2<i32>(uv * vec2<f32>(dims)), vec2<i32>(0, 0), dims - vec2<i32>(1, 1));
  return textureLoad(shadowMap, texelCoord, cascade, 0);
}

fn shadowDepthCompare(depth: f32, refDepth: f32) -> f32 {
  if (refDepth <= depth) {
    return 1.0;
  }
  return 0.0;
}

fn shadowCompareAt(cascade: i32, uv: vec2<f32>, refDepth: f32, texel: vec2<f32>) -> f32 {
  let texelPos = uv / texel - vec2<f32>(0.5);
  let base = floor(texelPos);
  let f = fract(texelPos);
  let minUV = texel * 0.5;
  let maxUV = vec2<f32>(1.0) - texel * 0.5;
  let uv00 = clamp((base + vec2<f32>(0.5, 0.5)) * texel, minUV, maxUV);
  let uv10 = clamp((base + vec2<f32>(1.5, 0.5)) * texel, minUV, maxUV);
  let uv01 = clamp((base + vec2<f32>(0.5, 1.5)) * texel, minUV, maxUV);
  let uv11 = clamp((base + vec2<f32>(1.5, 1.5)) * texel, minUV, maxUV);
  let c00 = shadowDepthCompare(sampleShadowDepth(cascade, uv00), refDepth);
  let c10 = shadowDepthCompare(sampleShadowDepth(cascade, uv10), refDepth);
  let c01 = shadowDepthCompare(sampleShadowDepth(cascade, uv01), refDepth);
  let c11 = shadowDepthCompare(sampleShadowDepth(cascade, uv11), refDepth);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

fn findAverageBlockerDepth(cascade: i32, shadowUV: vec2<f32>, refDepth: f32, texel: vec2<f32>, radius: i32) -> f32 {
  var blockerDepth = 0.0;
  var blockerCount = 0.0;
  for (var y = -radius; y <= radius; y = y + 1) {
    for (var x = -radius; x <= radius; x = x + 1) {
      let offset = vec2<f32>(f32(x), f32(y)) * texel;
      let depth = sampleShadowDepth(cascade, shadowUV + offset);
      if (depth < refDepth) {
        blockerDepth += depth;
        blockerCount += 1.0;
      }
    }
  }
  if (blockerCount <= 0.0) {
    return -1.0;
  }
  return blockerDepth / blockerCount;
}

fn sampleWeightedPCF(cascade: i32, shadowUV: vec2<f32>, refDepth: f32, texel: vec2<f32>, radius: i32, filterRadius: f32) -> f32 {
  if (radius == 0) {
    return shadowCompareAt(cascade, shadowUV, refDepth, texel);
  }
  var lit = 0.0;
  var weightSum = 0.0;
  for (var y = -radius; y <= radius; y = y + 1) {
    for (var x = -radius; x <= radius; x = x + 1) {
      let absOffset = vec2<f32>(abs(f32(x)), abs(f32(y)));
      if (absOffset.x <= filterRadius + 0.001 && absOffset.y <= filterRadius + 0.001) {
        let offset = vec2<f32>(f32(x), f32(y)) * texel;
        let weight = max(filterRadius + 1.0 - absOffset.x, 0.0) * max(filterRadius + 1.0 - absOffset.y, 0.0);
        lit += shadowCompareAt(cascade, shadowUV + offset, refDepth, texel) * weight;
        weightSum += weight;
      }
    }
  }
  return lit / max(weightSum, 1.0);
}

fn debugShadowSampleColor(sample: ShadowSample, alpha: f32) -> vec4<f32> {
  let mode = i32(shadow.debug.x + 0.5);
  if (mode == 3) {
    return vec4<f32>(shadowCascadeDebugColor(sample.cascade), alpha);
  }
  if (sample.inside < 0.5) {
    if (mode == 2) {
      return vec4<f32>(0.0, 0.0, 1.0, alpha);
    }
    return vec4<f32>(vec3<f32>(1.0), alpha);
  }
  if (mode == 1) {
    return vec4<f32>(vec3<f32>(sample.factor), alpha);
  }
  if (mode == 2) {
    return vec4<f32>(vec3<f32>(sample.rawDepth), alpha);
  }
  if (mode == 4) {
    return vec4<f32>(vec3<f32>(sample.refDepth), alpha);
  }
  if (mode == 5) {
    return vec4<f32>(vec3<f32>(clamp(sample.totalBias * 100.0, 0.0, 1.0)), alpha);
  }
  if (mode == 6) {
    return vec4<f32>(vec3<f32>(select(1.0, sample.blockerDepth, sample.blockerDepth >= 0.0)), alpha);
  }
  if (mode == 7) {
    return vec4<f32>(vec3<f32>(sample.filterRadius / max(shadow.debug.w, 1.0)), alpha);
  }
  if (mode == 8) {
    return vec4<f32>(vec3<f32>(sample.visibility), alpha);
  }
  return vec4<f32>(vec3<f32>(1.0), alpha);
}

fn sampleShadow(input: VertexOutput, normal: vec3<f32>) -> ShadowSample {
  let viewPos = shadow.cameraView * vec4<f32>(input.worldPos, 1.0);
  let cascade = selectShadowCascade(-viewPos.z);
  if (shadow.params.x < 0.5) {
    return ShadowSample(1.0, 1.0, 1.0, 1.0, 0.0, -1.0, 0.0, cascade, 0.0);
  }
  let shadowNormal = normalize(normal);
  var shadowClip = shadow.lightViewProjections[cascade] * vec4<f32>(input.worldPos, 1.0);
  if (shadow.params.w > 0.0) {
    let shadowOffset = shadow.lightViewProjections[cascade] * vec4<f32>(shadowNormal * shadow.params.w, 0.0);
    shadowClip = shadowClip + shadowOffset;
  }
  let shadowNdc = shadowClip.xyz / shadowClip.w;
  let shadowUV = vec2<f32>(shadowNdc.x * 0.5 + 0.5, 0.5 - shadowNdc.y * 0.5);
  if (
    shadowUV.x <= 0.0 || shadowUV.x >= 1.0 ||
    shadowUV.y <= 0.0 || shadowUV.y >= 1.0 ||
    shadowNdc.z <= 0.0 || shadowNdc.z >= 1.0
  ) {
    return ShadowSample(1.0, 1.0, 0.0, shadowNdc.z, 0.0, -1.0, 0.0, cascade, 0.0);
  }
  let dims = vec2<f32>(textureDimensions(shadowMap));
  let texel = 1.0 / max(dims, vec2<f32>(1.0, 1.0));
  let lightDirWorld = normalize(shadow.lightDirection.xyz);
  let cosTheta = clamp(dot(shadowNormal, -lightDirWorld), 0.001, 1.0);
  let slopeFactor = min(sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / cosTheta, 10.0);
  let slopeBias = shadow.lightDirection.w * slopeFactor;
  let totalBias = shadow.params.z + slopeBias;
  let refDepth = shadowNdc.z - totalBias;
  let radius = i32(clamp(shadow.debug.w, 0.0, 3.0));
  let rawDepth = sampleShadowDepth(cascade, shadowUV);
  var blockerDepth = -1.0;
  var filterRadius = f32(radius);
  var visibility = 1.0;
  if (shadow.soft.x > 0.5 && radius > 0) {
    blockerDepth = findAverageBlockerDepth(cascade, shadowUV, refDepth, texel, radius);
    if (blockerDepth >= 0.0) {
      let receiverBlockerSeparation = max(refDepth - blockerDepth, 0.0) * getCascadeDepthRange(cascade);
      let penumbraTexels = receiverBlockerSeparation * max(shadow.soft.y, 0.0) / max(getCascadeTexelWorldSize(cascade), 0.000001);
      filterRadius = clamp(max(shadow.soft.z, penumbraTexels), 0.0, f32(radius));
      visibility = sampleWeightedPCF(cascade, shadowUV, refDepth, texel, radius, filterRadius);
    }
  } else {
    visibility = sampleWeightedPCF(cascade, shadowUV, refDepth, texel, radius, filterRadius);
  }
  let factor = 1.0 - (1.0 - visibility) * shadow.params.y;
  return ShadowSample(factor, visibility, rawDepth, refDepth, totalBias, blockerDepth, filterRadius, cascade, 1.0);
}
`;
