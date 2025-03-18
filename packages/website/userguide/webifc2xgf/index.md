## Introduction

---

In this tutorial, we'll view an IFC 4.3 model in the browser using a xeokit doc:Viewer. To optimize performance, we'll first
convert the IFC model to XGF and DataModelParams JSON files. The import process consists of two steps:

1. Use `webifc2xgf` to convert IFC into XGF and JSON DataModelParams files.
2. Use `loadXGF` to load the XGF and JSON DataModelParams files into a xeokit Viewer in a webpage.

## Example IFC Model

---

For this tutorial, we'll use the IfcOpenHouse4 Bridge IFC model (source: [`http://drumbeat.cs.hut.fi/ifc/`](http://drumbeat.cs.hut.fi/ifc/)). 

Below is the final result— the model loaded from XGF and DataModelParams JSON files into a xeokit Viewer. 
In the following steps, we'll walk through the process of achieving this.

example-run:webifc2xgf_IfcOpenHouse4

<br>

## Step 1. Convert IFC into XGF and DataModelParams Files

---

The first step is to convert our IFC file into a set of intermediate XGF geometry and JSON DataModelParams files. We'll use
the [`webifc2xgf`]()
CLI tool to do this conversion step:

```bash
webifc2xgf -i IfcOpenHouse4.ifc -s model.xgf -d model.json
```

The parameters we provided the tool are:

- `-i` path to source IFC file
- `-s` path to target XGF SceneModel file
- `-d` path to target JSON DataModel file (optional)

<br>

## Step 2. View the XGF and DataModelParams Files

---

Now we'll create a Web page containing a xeokit doc:Viewer that views our converted model.

#### HTML

Create an HTML page in `index.html` that contains a canvas element:

example-html:webifc2xgf_IfcOpenHouse4

#### JavaScript

Then create JavaScript in `index.js` to create the doc:Viewer and view our converted model.

The steps in the JavaScript are as follows.

example-javascript:webifc2xgf_IfcOpenHouse4
