import type { ModelParser } from "../../../ModelParser";

/**
 * @private
 */
export const parse: ModelParser = async (
  params,
  options
) => {
  return new Promise<void>((resolve, reject) => {
    const { fileData, sceneModel} = params;

    if (sceneModel) {
      const ctx: ParseContext = {
        fileData,
        errors: [],
        warnings: [],
        sceneModel,
        options: options || {}
      };

      parseMTL(ctx, fileData || "");

      if (ctx.errors.length > 0) {
        return reject(`[MTLLoader] Failed to parse MTL file: ${ctx.errors[0]}`);
      }

      if (ctx.warnings.length > 0) {
        console.warn(`[MTLLoader] Warning while parsing MTL file: ${ctx.warnings[0]}`);
      }
    }

    resolve();
  });
};

interface ParsedMaterial {
  color: [number, number, number];
  opacity: number;
}

interface ParseContext {
  fileData: string;
  errors: string[];
  warnings: string[];
  sceneModel: any;
  options: any;
}

function parseMTL(ctx: ParseContext, text: string): void {
  const lines = text.split("\n");

  let current: ParsedMaterial | null = null;
  let currentId = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.length === 0 || line.charAt(0) === "#") {
      continue;
    }

    const space = line.indexOf(" ");
    const key = space !== -1 ? line.substring(0, space).toLowerCase() : line;
    const value = space !== -1 ? line.substring(space + 1).trim() : "";

    switch (key) {

      case "newmtl":
        if (current && currentId) {
          ctx.sceneModel.createMaterial({
            id: currentId,
            color: current.color,
            opacity: current.opacity
          });
        }
        currentId = value;
        current = {
          color: [0.8, 0.8, 0.8], // default
          opacity: 1
        };
        break;

      case "kd": {
        if (!current) {
          break;
        }
        const parts = value.split(/\s+/);
        current.color = [
          parseFloat(parts[0]),
          parseFloat(parts[1]),
          parseFloat(parts[2])
        ];
        break;
      }

      case "d": {
        if (!current) {
          break;
        }
        current.opacity = parseFloat(value);
        break;
      }

      case "tr": {
        if (!current) {
          break;
        }
        current.opacity = 1 - parseFloat(value);
        break;
      }
    }
  }

  if (current && currentId) {
    ctx.sceneModel.createMaterial({
      id: currentId,
      color: current.color,
      opacity: current.opacity
    });
  }
}
