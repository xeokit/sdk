import {identityMat4} from "../../../base/math/matrix";

export const GPU_BUFFER_USAGE = {
  MAP_READ: 1,
  COPY_SRC: 4,
  COPY_DST: 8,
  INDIRECT: 256,
  INDEX: 16,
  QUERY_RESOLVE: 512,
  STORAGE: 128,
  VERTEX: 32,
  UNIFORM: 64
} as const;

export const GPU_TEXTURE_USAGE = {
  COPY_SRC: 1,
  RENDER_ATTACHMENT: 16
} as const;

export const GPU_SHADER_STAGE = {
  VERTEX: 1,
  FRAGMENT: 2
} as const;

export const DEPTH_FORMAT = "depth24plus-stencil8";
export const ID_BUFFER_FORMAT = "rgba8unorm";
export const MAX_SECTION_PLANES = 8;
export const SECTION_PLANE_UNIFORM_OFFSET = 24;
export const SECTION_PLANE_CAP_COLOR_UNIFORM_OFFSET = SECTION_PLANE_UNIFORM_OFFSET + MAX_SECTION_PLANES * 4;
export const FRAME_UNIFORM_FLOATS = SECTION_PLANE_CAP_COLOR_UNIFORM_OFFSET + MAX_SECTION_PLANES * 4;
export const FRAME_UNIFORM_BYTES = FRAME_UNIFORM_FLOATS * 4;
export const RTC_TILE_FLOATS = 20;
export const RTC_TILE_BYTES = RTC_TILE_FLOATS * 4;
export const INSTANCE_FLOATS = 24;
export const INSTANCE_BYTES = INSTANCE_FLOATS * 4;
export const IDENTITY_MATRIX = identityMat4();
export const WEBGPU_CLIP_SPACE_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 0.5, 0,
  0, 0, 0.5, 1
];
