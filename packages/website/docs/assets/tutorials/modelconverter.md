---
title: Use ModelConverter Programmatically
---

# Use ModelConverter Programmatically

This tutorial shows how to use `ModelConverter`, the xeokit SDK's in-process
file format conversion pipeline.

`ModelConverter` is the conversion engine that `xeoconvert` drives from the
command line. Use `xeoconvert` when conversion belongs in a shell script, CI job
or asset build step. Use `ModelConverter` when conversion belongs inside your
own TypeScript or JavaScript code: a server endpoint, a desktop tool, a custom
asset pipeline, a test harness, or an application workflow that already has
model data in memory.

For the command-line workflow, see
[Use the xeoconvert CLI](https://xeokit.github.io/sdk/docs/assets/tutorials/xeoconvert-cli.md).
That tutorial covers the same conversion stack from the terminal. This tutorial
uses the programmatic API directly.

`ModelConverter` is headless. It does not create a `Viewer`, a `View` or a
renderer, and it does not display the model. Instead, it creates temporary SDK
model structures during conversion:

- A `SceneModel` holds visual content: geometry, meshes, materials, objects,
  transforms and renderable structure.
- A `DataModel` holds semantic content: object types, names, relationships and
  property data.

Loaders fill those models from source files. Exporters serialize those models
to target formats. A pipeline connects named inputs to loaders and named
outputs to exporters.

For example, a glTF-to-XGF pipeline says: read a `gltf` input with
`GLTFLoader`, populate a `SceneModel`, then write an `xgf` output with
`XGFExporter`. An IFC-to-XGF-and-DataModel pipeline says: read an `ifc` input
with `IFCLoader`, populate both a `SceneModel` and a `DataModel`, then export
visual XGF and semantic DataModel JSON.

`ModelConverter.convert()` returns the converted output data in memory. Your
code decides where to write it, upload it or pass it next.

---

## 1. Configure a Converter

The converter is built from three maps:

- `loaders` names the supported input readers.
- `exporters` names the supported output writers.
- `pipelines` names reusable conversion recipes.

This example creates a small converter that reads glTF/GLB and writes XGF plus
DataModel JSON.

```ts
import {ModelConverter} from "@xeokit/sdk/conversion/pipeline";
import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {DataModelExporter} from "@xeokit/sdk/formats/datamodel";
import {XGFExporter} from "@xeokit/sdk/formats/xgf";

const converter = new ModelConverter({
  loaders: {
    gltf: new GLTFLoader()
  },
  exporters: {
    xgf: new XGFExporter(),
    datamodel: new DataModelExporter()
  },
  pipelines: {
    gltf2xgf: {
      inputs: {
        gltf: {
          loader: "gltf",
          sceneModel: "main",
          dataModel: "main"
        }
      },
      outputs: {
        xgf: {
          exporter: "xgf",
          sceneModel: "main"
        },
        datamodel: {
          exporter: "datamodel",
          dataModel: "main"
        }
      }
    }
  }
});
```

The names are local to this converter. The pipeline input named `gltf` uses the
loader registered as `gltf`. The output named `xgf` uses the exporter
registered as `xgf`.

The `sceneModel` and `dataModel` values are model IDs inside the temporary
`Scene` and `Data` containers that the converter creates for each conversion.
Use the same IDs when several inputs and outputs need to share the same visual
or semantic model.

---

## 2. Run a Conversion

In Node.js, read the source file yourself and pass it as `fileData`. The
converted files are returned on `result.outputs`.

```ts
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import type {ModelConverterResultOutput} from "@xeokit/sdk/conversion/pipeline";

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

async function writeOutput(path: string, output: ModelConverterResultOutput) {
  await mkdir(dirname(path), {recursive: true});

  if (output.fileDataType === "json") {
    await writeFile(path, JSON.stringify(output.fileData, null, 2), "utf-8");
    return;
  }

  await writeFile(path, Buffer.from(output.fileData));
}

const gltfFileData = toArrayBuffer(await readFile("./models/source/house.glb"));

const result = await converter.convert({
  pipeline: "gltf2xgf",
  inputs: {
    gltf: {
      fileData: gltfFileData
    }
  },
  outputs: {},
  reports: {},
  yieldIntervalMs: 1000
});

if (result.errors.length > 0) {
  throw new Error(result.errors.join("\n"));
}

await writeOutput("./public/models/house/model.xgf", result.outputs.xgf);
await writeOutput("./public/models/house/datamodel.json", result.outputs.datamodel);
```

The request's `inputs` keys must match the pipeline's input keys. The result's
`outputs` keys match the pipeline's output keys.

Use `yieldIntervalMs` to control how often long-running loaders, exporters and
inspection passes yield back to the host. In a headless Node conversion job, a
larger value trades responsiveness for throughput.

---

## 3. Convert IFC to XGF and DataModel JSON

IFC usually contains both visual geometry and BIM semantics. Configure the IFC
loader to populate the same `SceneModel` and `DataModel`, then export each part
to the format your viewer will load.

```ts
import {ModelConverter} from "@xeokit/sdk/conversion/pipeline";
import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {DataModelExporter} from "@xeokit/sdk/formats/datamodel";
import {XGFExporter} from "@xeokit/sdk/formats/xgf";

const ifcConverter = new ModelConverter({
  loaders: {
    ifc: new IFCLoader()
  },
  exporters: {
    xgf: new XGFExporter(),
    datamodel: new DataModelExporter()
  },
  pipelines: {
    ifc2xgf: {
      inputs: {
        ifc: {
          loader: "ifc",
          sceneModel: "building",
          dataModel: "building"
        }
      },
      outputs: {
        xgf: {
          exporter: "xgf",
          sceneModel: "building"
        },
        datamodel: {
          exporter: "datamodel",
          dataModel: "building"
        }
      }
    }
  }
});
```

The conversion call has the same shape as the glTF example:

```ts
const ifcFileData = await readFile("./models/source/building.ifc", "utf-8");

const result = await ifcConverter.convert({
  pipeline: "ifc2xgf",
  inputs: {
    ifc: {
      fileData: ifcFileData
    }
  },
  outputs: {},
  reports: {},
  yieldIntervalMs: 1000
});

if (result.errors.length > 0) {
  throw new Error(result.errors.join("\n"));
}

await writeOutput("./public/models/building/model.xgf", result.outputs.xgf);
await writeOutput(
  "./public/models/building/datamodel.json",
  result.outputs.datamodel
);
```

After this, a viewer can load the XGF with `XGFLoader` and the DataModel JSON
with `DataModelImporter`.

---

## 4. Use the Built-In Converter

The SDK also exports the configured converter used by `xeoconvert`. It registers
the standard loaders, exporters and named pipelines such as `ifc2xgf`,
`ifc2xgfstream`, `gltf`, `gltf2xgf`, `xgf`, `json` and other format workflows.

```ts
import {modelConverter} from "@xeokit/sdk/conversion/xeoconvert";

const result = await modelConverter.convert({
  pipeline: "ifc2xgf",
  inputs: {
    ifc: {
      fileData: await readFile("./models/source/building.ifc", "utf-8")
    }
  },
  outputs: {},
  reports: {},
  yieldIntervalMs: 1000
});

if (result.errors.length > 0) {
  throw new Error(result.errors.join("\n"));
}

await writeOutput("./public/models/building/model.xgf", result.outputs.xgf);
await writeOutput(
  "./public/models/building/datamodel.json",
  result.outputs.datamodel
);
```

Use the built-in converter when you want the same default conversion vocabulary
as the CLI. Create your own `ModelConverter` when you need a smaller dependency
surface, custom loader/exporter instances, custom pipeline names, or application
specific loader/exporter options.

---

## 5. Inspect or Repair Before Export

A pipeline can inspect loaded models before output files are written. Inspection
runs after all inputs are loaded and before exporters serialize the result.

```ts
const checkedConverter = new ModelConverter({
  loaders: {
    ifc: new IFCLoader()
  },
  exporters: {
    xgf: new XGFExporter(),
    datamodel: new DataModelExporter()
  },
  pipelines: {
    ifc2xgf: {
      inputs: {
        ifc: {
          loader: "ifc",
          sceneModel: "building",
          dataModel: "building"
        }
      },
      inspect: {
        enabled: true,
        checks: {
          checkGeometryQuality: true,
          checkTextureSanity: true,
          checkObjectStructure: true
        },
        dataChecks: {
          checkRelationshipCycles: true
        },
        fix: true,
        reInspect: true,
        failOnErrors: true,
        async: true
      },
      outputs: {
        xgf: {
          exporter: "xgf",
          sceneModel: "building"
        },
        datamodel: {
          exporter: "datamodel",
          dataModel: "building"
        }
      }
    }
  }
});
```

Use `fix: true` only for repair strategies you are comfortable applying before
export. Validation errors still need attention; automatic repair is a pipeline
tool, not a substitute for understanding source-data quality.

Inspection reports are returned on the result:

```ts
const report = result.inspection?.bySceneModel?.building?.report;

if (report && report.errors.length > 0) {
  console.error(report.errors);
}
```

---

## 6. Cancel a Long Conversion

Pass an `AbortSignal` when the caller needs to cancel a conversion. The signal
is propagated through loaders, exporters, inspection and between-phase yields.

```ts
const controller = new AbortController();

const conversion = modelConverter.convert({
  pipeline: "ifc2xgf",
  inputs: {
    ifc: {
      fileData: await readFile("./models/source/building.ifc", "utf-8")
    }
  },
  outputs: {},
  reports: {},
  signal: controller.signal,
  yieldIntervalMs: 250
});

controller.abort();

await conversion;
```

In production code, handle the `AbortError` separately from conversion errors so
cancellation does not look like a failed model.

---

## 7. Choose the API or the CLI

Use `ModelConverter` when:

- conversion is part of an application or service
- input data is already in memory
- converted output needs to be uploaded, cached or passed directly to another
  process
- the pipeline needs custom loader/exporter instances or options
- conversion needs request-level cancellation

Use `xeoconvert` when:

- conversion is part of a shell script, CI job or asset build
- source and target files already live on disk
- the built-in command flags are enough
- reports and manifests should be written as files beside the converted model

Both routes use the same loader/exporter model. The difference is where the
conversion is driven: `ModelConverter` is driven by your code, while
`xeoconvert` is driven by command-line arguments.
