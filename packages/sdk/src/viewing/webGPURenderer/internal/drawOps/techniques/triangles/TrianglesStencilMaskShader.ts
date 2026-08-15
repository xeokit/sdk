import {TRIANGLE_POSITION_DECODE_WGSL, TRIANGLE_RTC_TILE_WGSL} from "./TrianglePositionPacking";

/**
 * WGSL shader for the WebGPU section-plane cap stencil mask pass.
 *
 * @internal
 */
export const TRIANGLES_STENCIL_MASK_SHADER = `
struct FrameUniforms {
  viewProjection: mat4x4<f32>,
  ambientLight: vec4<f32>,
  dirLightDirections: array<vec4<f32>, 3>,
  dirLightColors: array<vec4<f32>, 3>,
  sectionPlaneState: vec4<f32>,
  sectionPlanes: array<vec4<f32>, 8>,
  sectionPlaneCapColors: array<vec4<f32>, 8>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct MeshInstance {
  modelMatrix: mat4x4<f32>,
  color: vec4<f32>,
  flags: vec4<f32>,
};

@group(1) @binding(0) var<storage, read> instances: array<MeshInstance>;

${TRIANGLE_POSITION_DECODE_WGSL}
${TRIANGLE_RTC_TILE_WGSL}

struct CapParams {
  capPlaneIndex: vec4<f32>,
};

@group(3) @binding(0) var<uniform> capParams: CapParams;

struct VertexInput {
  @location(0) packedPosition: vec4<f32>,
  @location(1) vertexMetadata: vec2<u32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) clippable: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let instance = instances[input.vertexMetadata.x];
  let rtcTile = getInstanceRTCTile(instance);
  let localPosition = decodePackedPosition(input.packedPosition, input.vertexMetadata.y);
  let rtcWorldPos = instance.modelMatrix * vec4<f32>(localPosition, 1.0);
  var output: VertexOutput;
  output.position = rtcTile.viewProjection * rtcWorldPos;
  output.worldPos = (rtcWorldPos.xyz / rtcWorldPos.w) + rtcTile.center.xyz;
  output.clippable = instance.flags.x;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  if (input.clippable < 0.5 || frame.sectionPlaneState.x <= 0.0) {
    discard;
  }
  let planeIndex = u32(capParams.capPlaneIndex.x);
  if (planeIndex >= u32(frame.sectionPlaneState.x)) {
    discard;
  }
  let capPlane = frame.sectionPlanes[planeIndex];
  if (dot(capPlane.xyz, input.worldPos) + capPlane.w <= 0.0) {
    discard;
  }
  return vec4<f32>(0.0);
}
`;
