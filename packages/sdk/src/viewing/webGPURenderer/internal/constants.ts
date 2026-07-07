import {identityMat4} from "../../../base/math/matrix";

export const GPU_BUFFER_USAGE = {
  COPY_DST: 8,
  INDEX: 16,
  VERTEX: 32,
  UNIFORM: 64
} as const;

export const GPU_TEXTURE_USAGE = {
  RENDER_ATTACHMENT: 16
} as const;

export const GPU_SHADER_STAGE = {
  VERTEX: 1,
  FRAGMENT: 2
} as const;

export const DEPTH_FORMAT = "depth24plus";
export const FRAME_UNIFORM_FLOATS = 20;
export const FRAME_UNIFORM_BYTES = FRAME_UNIFORM_FLOATS * 4;
export const INSTANCE_FLOATS = 36;
export const INSTANCE_BYTES = INSTANCE_FLOATS * 4;
export const IDENTITY_MATRIX = identityMat4();
export const WEBGPU_CLIP_SPACE_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 0.5, 0,
  0, 0, 0.5, 1
];

export const TRIANGLE_SHADER = `
struct FrameUniforms {
  viewProjection: mat4x4<f32>,
  lightDirectionAndAmbient: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) modelMatrix0: vec4<f32>,
  @location(3) modelMatrix1: vec4<f32>,
  @location(4) modelMatrix2: vec4<f32>,
  @location(5) modelMatrix3: vec4<f32>,
  @location(6) normalMatrix0: vec4<f32>,
  @location(7) normalMatrix1: vec4<f32>,
  @location(8) normalMatrix2: vec4<f32>,
  @location(9) normalMatrix3: vec4<f32>,
  @location(10) color: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) normal: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let modelMatrix = mat4x4<f32>(
    input.modelMatrix0,
    input.modelMatrix1,
    input.modelMatrix2,
    input.modelMatrix3
  );
  let normalMatrix = mat4x4<f32>(
    input.normalMatrix0,
    input.normalMatrix1,
    input.normalMatrix2,
    input.normalMatrix3
  );
  var output: VertexOutput;
  output.position = frame.viewProjection * modelMatrix * vec4<f32>(input.position, 1.0);
  output.color = input.color;
  output.normal = normalize((normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let normal = normalize(input.normal);
  let lightDirection = normalize(frame.lightDirectionAndAmbient.xyz);
  let ambient = frame.lightDirectionAndAmbient.w;
  let diffuse = max(dot(normal, lightDirection), 0.0);
  let lighting = ambient + diffuse * (1.0 - ambient);
  return vec4<f32>(input.color.rgb * lighting, input.color.a);
}
`;
