## Introduction

---

In this tutorial, we'll view an IFC 4.3 model in the browser using a xeokit doc:Viewer. To optimize performance, we'll first
convert the IFC model to glTF and metadata JSON files. The import process consists of two steps:

1. Use `ifc2gltf` to convert IFC into glTF and JSON metadata files.
2. Use `loadGLTF` to load the glTF and JSON metadata files into a xeokit Viewer on a webpage.

This process also splits the model into multiple files, improving memory stability in the converter tools and
Viewer by allowing incremental loading and deallocation.

## Example IFC Model

---

For this tutorial, we'll use the Karhumaki Bridge IFC model (source: [`http://drumbeat.cs.hut.fi/ifc/`](http://drumbeat.cs.hut.fi/ifc/)). 

Below is the final result— the model loaded from glTF and JSON files into a xeokit Viewer. 
In the following steps, we'll walk through the process of achieving this.

example-run:ifc2gltf_Karhumaki

<br>

## Step 1. Convert IFC into glTF and Metadata Files

---

The first step is to convert our IFC file into a set of intermediate glTF geometry and JSON metadata files. We'll use
the [`ifc2gltf`]()
CLI tool to do this conversion step:

```bash
ifc2gltfcxconverter -i Karhumaki-Bridge.ifc -o model.glb -m model.json -s 100
```

The parameters we provided the tool are:

- `-i` specifies the IFC file to convert
- `-o` specifies the name to prefix on each output glTF file
- `-m` specifies the name to prefix on each JSON metadata file
- `-s` specifies the maximum number of megabytes in each glTF file - smaller value means more output files, lower value
  means less files

The files output by `ifc2gltf` are listed below. Each of the JSON files follows the schema defined
by MetaModelParams, which is xeokit's legacy format for semantic model data.

```bash
.
├── model.glb.manifest.json
├── model_1.glb
├── model_1.json
├── model_2.glb
├── model_2.json
├── model_3.glb
├── model_3.json
├── model_4.glb
├── model_4.json
├── model_5.glb
├── model_5.json
├── model_6.glb
├── model_6.json
├── model_7.glb
├── model_7.json
├── model_8.glb
├── model_8.json
├── model_9.glb
├── model_9.json
├── model.glb
└── model.json
```

The `model.glb.manifest.json` manifest looks like below. This manifest follows the schema defined by Ifc2gltfManifestParams.

```json
{
    "inputFile": "Karhumaki-Bridge.ifc",
    "converterApplication": "ifc2gltfcxconverter",
    "converterApplicationVersion": "2.8.6",
    "conversionDate": "2023-09-08 03:01:39",
    "gltfOutFiles": [
        "model.glb",
        "model_1.glb",
        "model_2.glb",
        "model_3.glb",
        "model_4.glb",
        "model_5.glb",
        "model_6.glb",
        "model_7.glb",
        "model_8.glb",
        "model_9.glb"
    ],
    "metadataOutFiles": [
        "model.json",
        "model_1.json",
        "model_2.json",
        "model_3.json",
        "model_4.json",
        "model_5.json",
        "model_6.json",
        "model_7.json",
        "model_8.json",
        "model_9.json"
    ]
}
```

<br>

## Step 2. View the glTF and Metadata Files

---

Now we'll create a Web page containing a xeokit doc:Viewer that views our converted model.

#### HTML

Create an HTML page in `index.html` that contains a canvas element:

example-html:ifc2gltf_Karhumaki

#### JavaScript

Then create JavaScript in `index.js` to create the doc:Viewer and view our converted model.

The steps in the JavaScript are as follows.

example-javascript:ifc2gltf_Karhumaki
