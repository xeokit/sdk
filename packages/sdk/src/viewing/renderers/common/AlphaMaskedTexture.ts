export type AlphaMaskedColorImageData = ImageData | {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
};

/**
 * Converts an image into RGB-sanitized ImageData for alpha-masked color maps.
 *
 * Fully or mostly transparent source texels often carry arbitrary RGB values
 * from authoring tools, commonly white. Bilinear filtering can then pull those
 * colors into the visible cutout edge even when the fragment shader discards
 * low-alpha pixels. This fills low-alpha texel RGB from nearby opaque texels
 * while preserving alpha, so MASK materials keep clean filtered edges.
 *
 * @internal
 */
export function createSanitizedAlphaMaskedColorImageData(
  image: unknown,
  flipY: boolean,
  width: number,
  height: number
): ImageData | null {
  const canvas = createAlphaMaskCanvas(width, height);
  if (!canvas) {
    return null;
  }
  const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) {
    return null;
  }
  context.clearRect(0, 0, width, height);
  try {
    if (flipY) {
      context.save();
      context.translate(0, height);
      context.scale(1, -1);
      context.drawImage(image as CanvasImageSource, 0, 0, width, height);
      context.restore();
    } else {
      context.drawImage(image as CanvasImageSource, 0, 0, width, height);
    }
    return sanitizeAlphaMaskedColorImageData(context.getImageData(0, 0, width, height)) as ImageData;
  } catch {
    return null;
  }
}

/**
 * Dilates opaque-neighbour RGB into low-alpha texels without changing alpha.
 *
 * @internal
 */
export function sanitizeAlphaMaskedColorImageData<T extends AlphaMaskedColorImageData>(imageData: T): T | ImageData {
  const source = imageData.data;
  const data = new Uint8ClampedArray(source);
  const width = imageData.width;
  const height = imageData.height;
  let changed = false;

  for (let pass = 0; pass < 8; pass++) {
    let passChanged = false;
    const previous = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        if (previous[offset + 3] >= 128) {
          continue;
        }
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) {
            continue;
          }
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) {
              continue;
            }
            const nx = x + dx;
            if (nx < 0 || nx >= width) {
              continue;
            }
            const neighbourOffset = (ny * width + nx) * 4;
            if (previous[neighbourOffset + 3] < 128) {
              continue;
            }
            r += previous[neighbourOffset];
            g += previous[neighbourOffset + 1];
            b += previous[neighbourOffset + 2];
            count++;
          }
        }
        if (count === 0) {
          continue;
        }
        data[offset] = Math.round(r / count);
        data[offset + 1] = Math.round(g / count);
        data[offset + 2] = Math.round(b / count);
        passChanged = true;
      }
    }
    if (!passChanged) {
      break;
    }
    changed = true;
  }

  if (!changed) {
    return imageData;
  }
  if (typeof ImageData !== "undefined") {
    return new ImageData(data, width, height);
  }
  return {data, width, height} as T;
}

function createAlphaMaskCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}
