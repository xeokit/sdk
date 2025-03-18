## Introduction 

---

In this tutorial, we'll load an IFC 4.3 model into a xeokit doc:Viewer. To optimize performance, we'll first 
convert the IFC model to XGF, xeokit's native compressed format. The whole process consists of three steps:
1. Use `ifc2gltf` to convert the IFC into glTF and JSON metadata (*intermediate format*).
2. Use `ifc2gltf2xkt` to convert the glTF and JSON into XGF and a JSON data model (*final format*).
3. Use `loadXGF` to load the XGF and JSON data model into a xeokit Viewer on a webpage.

This process splits the model into multiple files, improving memory stability in the converter tools and 
Viewer by allowing incremental loading and deallocation.

## Example IFC Model
---

For this tutorial, we'll use the Karhumaki Bridge IFC model (source: [`http://drumbeat.cs.hut.fi/ifc/`](http://drumbeat.cs.hut.fi/ifc/)).

Below is the final result— the model loaded from XGF and JSON files into a xeokit Viewer.
In the following steps, we'll walk through the process of achieving this.

example-run:ifc2gltf2xgf_Karhumaki

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
- `-m` specifies the name to prefix on each JSON metamodel file
- `-s` specifies the maximum number of megabytes in each glTF file - smaller value means more output files, lower value
  means less files

The files output by `ifc2gltf` are listed below. Each of the JSON files follows the schema defined
by doc:MetaModelParams, which is xeokit's legacy format for semantic model data.

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

The `model.glb.manifest.json` manifest looks like below. This manifest follows the schema defined by doc:Ifc2gltfManifestParams. 

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

## Step 2. Convert glTF and Metadata to XGF and DataModel Files

---

The next step is to convert our set of intermediate glTF geometry and JSON metamodel files into the final set of XGF and data model files. 

We'll use the [`ifc2gltf2xgf`]()
CLI tool to do this conversion step:

```bash
node ifc2gltf2xgf -i model.glb.manifest.json -o model.xgf.manifest.json
```

The parameters we provided the tool are:

- `-i` specifies the glTF+Metadata manifest file to convert
- `-o` specifies the XGF+DataModel manifest file to output

The files output by `ifc2gltf2xgf` are listed below. Each of the JSON files follows the schema defined
by doc:DataModelParams, which is xeokit's new and more expressive *entity-relationship graph* format for semantic model data.

```bash
.
├── model.xgf.manifest.json
├── model_1.xgf
├── model_1.datamodel.json
├── model_2.xgf
├── model_2.datamodel.json
├── model_3.xgf
├── model_3.datamodel.json
├── model_4.xgf
├── model_4.datamodel.json
├── model_5.xgf
├── model_5.datamodel.json
├── model_6.xgf
├── model_6.datamodel.json
├── model_7.xgf
├── model_7.datamodel.json
├── model_8.xgf
├── model_8.datamodel.json
├── model_9.xgf
├── model_9.datamodel.json
├── model.xgf
└── model.datamodel.json
```

The `model.xgf.manifest.json` manifest looks like below. This manifest follows the schema defined by doc:ModelChunksManifestParams.

```json

{
    "sceneModelMIMEType": "arraybuffer",
    "sceneModelFiles": [
        "model.xgf",
        "model_1.xgf",
        "model_2.xgf",
        "model_3.xgf",
        "model_4.xgf",
        "model_5.xgf",
        "model_6.xgf",
        "model_7.xgf",
        "model_8.xgf",
        "model_9.xgf"
    ],
    "dataModelFiles": [
        "model.datamodel.json",
        "model_1.datamodel.json",
        "model_2.datamodel.json",
        "model_3.datamodel.json",
        "model_4.datamodel.json",
        "model_5.datamodel.json",
        "model_6.datamodel.json",
        "model_7.datamodel.json",
        "model_8.datamodel.json",
        "model_9.datamodel.json"
    ]
}
```

<br>

## Step 3. View the XGF and DataModel Files

---

Now we'll create a Web page containing a xeokit doc:Viewer and view our converted model with it.

#### HTML

First, create an HTML page in `index.html` that contains a canvas element:

example-html:ifc2gltf2xgf_Karhumaki

#### JavaScript

Then create JavaScript in `index.js` to create the doc:Viewer and view our converted model.

The steps in the JavaScript are as follows.

example-javascript:ifc2gltf2xgf_Karhumaki
