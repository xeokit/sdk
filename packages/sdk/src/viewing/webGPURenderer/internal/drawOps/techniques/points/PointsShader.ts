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
  @builtin(vertex_index) vertexIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) worldPos: vec3<f32>,
  @location(2) clippable: f32,
  @location(3) corner: vec2<f32>,
  @location(4) slot: f32,
};

fn pointCorner(cornerIndex: u32) -> vec2<f32> {
  if (cornerIndex == 0u) { return vec2<f32>(-1.0, -1.0); }
  if (cornerIndex == 1u) { return vec2<f32>(1.0, -1.0); }
  if (cornerIndex == 2u) { return vec2<f32>(1.0, 1.0); }
  if (cornerIndex == 3u) { return vec2<f32>(-1.0, -1.0); }
  if (cornerIndex == 4u) { return vec2<f32>(1.0, 1.0); }
  return vec2<f32>(-1.0, 1.0);
}

fn getPointSize(clipW: f32) -> f32 {
  var size = frame.pointParams0.x;
  if (frame.pointParams0.y > 0.5) {
    size = (frame.pointParams0.w * frame.pointParams0.x) / max(clipW, 0.000001);
    size = clamp(size, frame.pointParams1.x, frame.pointParams1.y);
  }
  ${pick ? "size = max(size, 7.0);" : ""}
  return size;
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let instance = instances[input.vertexMetadata.x];
  let rtcTile = getInstanceRTCTile(instance);
  let localPosition = decodePackedPosition(input.packedPosition, input.vertexMetadata.y);
  let rtcWorldPos = instance.modelMatrix * vec4<f32>(localPosition, 1.0);
  let worldPos = (rtcWorldPos.xyz / rtcWorldPos.w) + rtcTile.center.xyz;
  let clipPos = rtcTile.viewProjection * rtcWorldPos;
  let corner = pointCorner(input.vertexIndex % 6u);
  let pointSize = getPointSize(clipPos.w);
  let viewport = vec2<f32>(max(frame.pointParams1.z, 1.0), max(frame.pointParams1.w, 1.0));
  let ndcOffset = corner * pointSize / viewport * 2.0;

  var output: VertexOutput;
  output.position = vec4<f32>(clipPos.xy + ndcOffset * clipPos.w, clipPos.z, clipPos.w);
  output.color = vec4<f32>(input.vertexColor.rgb * instance.color.rgb, input.vertexColor.a * instance.color.a);
  output.worldPos = worldPos;
  output.clippable = instance.flags.x;
  output.corner = corner;
  output.slot = f32(input.vertexMetadata.x);
  return output;
}
`;
}

/**
 * @internal
 */
export function createPointsDrawColorShader(): string {
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
  if (frame.pointParams0.z > 0.5 && dot(input.corner, input.corner) > 1.0) {
    discard;
  }
  return input.color;
}
`;
}

/**
 * @internal
 */
export function createPointsPickShader(): string {
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
  if (frame.pointParams0.z > 0.5 && dot(input.corner, input.corner) > 1.0) {
    discard;
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
