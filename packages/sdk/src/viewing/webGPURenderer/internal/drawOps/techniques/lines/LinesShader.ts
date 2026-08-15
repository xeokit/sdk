import {TRIANGLE_POSITION_DECODE_WGSL, TRIANGLE_RTC_TILE_WGSL} from "../triangles/TrianglePositionPacking";

function frameUniformsWGSL(): string {
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
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
`;
}

function commonWGSL(pick: boolean): string {
  return `
struct MeshInstance {
  modelMatrix: mat4x4<f32>,
  color: vec4<f32>,
  flags: vec4<f32>,
};

@group(1) @binding(0) var<storage, read> instances: array<MeshInstance>;

${TRIANGLE_POSITION_DECODE_WGSL}
${TRIANGLE_RTC_TILE_WGSL}

struct VertexInput {
  @location(0) packedPosition: vec4<f32>,
  @location(1) vertexMetadata: vec2<u32>,
  @location(2) vertexColor: vec4<f32>,
  @location(3) packedOtherPosition: vec4<f32>,
  @builtin(vertex_index) vertexIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) worldPos: vec3<f32>,
  @location(2) clippable: f32,
  @location(3) lineCoord: vec2<f32>,
  @location(4) slot: f32,
};

fn lineSide(cornerIndex: u32) -> f32 {
  if (cornerIndex == 0u || cornerIndex == 1u || cornerIndex == 3u) {
    return -1.0;
  }
  return 1.0;
}

fn lineEndpoint(cornerIndex: u32) -> f32 {
  if (cornerIndex == 0u || cornerIndex == 3u || cornerIndex == 5u) {
    return 0.0;
  }
  return 1.0;
}

fn lineCap(endpoint: f32, side: f32) -> vec2<f32> {
  return vec2<f32>((endpoint * 2.0) - 1.0, side);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let instance = instances[input.vertexMetadata.x];
  let rtcTile = getInstanceRTCTile(instance);
  let localPosition = decodePackedPosition(input.packedPosition, input.vertexMetadata.y);
  let localOtherPosition = decodePackedPosition(input.packedOtherPosition, input.vertexMetadata.y);
  let rtcWorldPos = instance.modelMatrix * vec4<f32>(localPosition, 1.0);
  let rtcOtherWorldPos = instance.modelMatrix * vec4<f32>(localOtherPosition, 1.0);
  let worldPos = (rtcWorldPos.xyz / rtcWorldPos.w) + rtcTile.center.xyz;
  let clipPos = rtcTile.viewProjection * rtcWorldPos;
  let otherClipPos = rtcTile.viewProjection * rtcOtherWorldPos;
  let cornerIndex = input.vertexIndex % 6u;
  let side = lineSide(cornerIndex);
  let endpoint = lineEndpoint(cornerIndex);
  let viewport = vec2<f32>(max(frame.lineParams.y, 1.0), max(frame.lineParams.z, 1.0));
  let ndc = clipPos.xy / max(clipPos.w, 0.000001);
  let otherNdc = otherClipPos.xy / max(otherClipPos.w, 0.000001);
  let screenDir = (otherNdc - ndc) * viewport;
  var safeDir = vec2<f32>(1.0, 0.0);
  if (dot(screenDir, screenDir) > 0.000001) {
    safeDir = normalize(screenDir);
  }
  let normal = vec2<f32>(-safeDir.y, safeDir.x);
  let width = ${pick ? "max(frame.lineParams.x, 7.0)" : "frame.lineParams.x"};
  let pixelOffset = normal * side * width * 0.5;
  let ndcOffset = pixelOffset / viewport * 2.0;

  var output: VertexOutput;
  output.position = vec4<f32>(clipPos.xy + ndcOffset * clipPos.w, clipPos.z, clipPos.w);
  output.color = vec4<f32>(input.vertexColor.rgb * instance.color.rgb, input.vertexColor.a * instance.color.a);
  output.worldPos = worldPos;
  output.clippable = instance.flags.x;
  output.lineCoord = lineCap(endpoint, side);
  output.slot = f32(input.vertexMetadata.x);
  return output;
}
`;
}

/**
 * @internal
 */
export function createLinesDrawColorShader(): string {
  return `
${frameUniformsWGSL()}
${commonWGSL(false)}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
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
  return input.color;
}
`;
}

/**
 * @internal
 */
export function createLinesPickShader(): string {
  return `
${frameUniformsWGSL()}
${commonWGSL(true)}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
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
  let encoded = u32(input.slot) + 1u;
  return vec4<f32>(
    f32(encoded & 255u) / 255.0,
    f32((encoded >> 8u) & 255u) / 255.0,
    f32((encoded >> 16u) & 255u) / 255.0,
    f32((encoded >> 24u) & 255u) / 255.0
  );
}
`;
}
