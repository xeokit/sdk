## Introduction 

---

In this tutorial, we'll load a glTF model into a xeokit doc:Viewer. To optimize performance, we'll first 
convert the glTF model to XGF, xeokit's native compressed format. The whole process consists of two steps:
1. Use `gltf2xkt` to convert the glTF into XGF.
2Use `XGFLoader` to load the XGF into a xeokit Viewer on a webpage.

## Example Model
---

Below is the final result— the model loaded from an XGF file into a xeokit Viewer.
In the following steps, we'll walk through the process of achieving this.

example-run:gltf2xgf_Duplex

<br>

## Step 1. Convert glTF to XGF

---

The first step is to convert our glTF file into an XGF file. 

We'll use the [`gltf2xgf`]()
CLI tool to do this conversion step:

```bash
node gltf2xgf -i model.glb -o model.xgf
```

The parameters we provided the tool are:

- `-i` specifies the glTF file to convert
- `-o` specifies the XGF file to output

<br>

## Step 2. View the XGF File

---

Now we'll create a Web page containing a xeokit doc:Viewer and view our converted model with it.

#### HTML

First, create an HTML page in `index.html` that contains a canvas element:

example-html:gltf2xgf_Duplex

#### JavaScript

Then create JavaScript in `index.js` to create the doc:Viewer and view our converted model.

The steps in the JavaScript are as follows.

example-javascript:gltf2xgf_Duplex
