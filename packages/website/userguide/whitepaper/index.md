## Table of Contents

<br>

- [1. Introduction](#1-introduction)
- [2. Resource Links](#2-resource-links)
- [3. Use Cases](#3-use-cases)
    - [3.1. BIM Model Visualization](#31-bim-model-visualization)
    - [3.2. Web-Based BIM Collaboration](#32-web-based-bim-collaboration)
    - [3.3. GIS and LiDAR Integration](#33-gis-and-lidar-integration)
    - [3.4. Interactive Model Analysis](#34-interactive-model-analysis)
    - [3.5. Web-Based Digital Twin Applications](#35-web-based-digital-twin-applications)
    - [3.6. AEC Model Conversion and Processing](#36-aec-model-conversion-and-processing)
    - [3.7. Custom Web-Based 3D Applications](#37-custom-web-based-3d-applications)
- [4. Features](#4-features)
- [5. Viewing AEC Models](#5-viewing-aec-models)
- [6. Code Modules](#6-code-modules)
    - [6.1. Scene Module](#61-scene-module)
    - [6.2. Viewer Modules](#62-viewer-modules)
    - [6.3. Data Module](#63-data-module)
    - [6.4. Model Importer and Exporter Modules](#64-model-importer-and-exporter-modules)
    - [6.5. Model Converter Modules](#65-model-converter-modules)
    - [6.6. BCF Support Module](#66-bcf-support-module)
    - [6.7. Collision Detection Modules](#67-collision-detection-modules)
    - [6.8. Utility Library Modules](#68-utility-library-modules)
- [7. Usage Examples](#7-usage-examples)
    - [7.1. Example: View an IFC Model and Hide All IfcSpaces](#71-example-view-an-ifc-model-and-hide-all-ifcspaces)

---

<a name="1-introduction"></a>
## 1. Introduction
---
The **xeokit SDK** is an open-source toolkit for real-time 3D visualization in web-based **Architecture, Engineering, and Construction (AEC)** applications. Key features include:
- Smooth interaction with large 3D models using **double-precision coordinates** to prevent floating-point errors.
- A powerful rendering engine provided by the **Viewer module**, supporting multiple canvases, object interaction, and customizable effects.
- A **Scene module** that manages 3D geometries, materials, and model structure.
- A **Data module** that integrates semantic metadata for querying and analysis.

This document details the SDK’s architecture, rendering techniques, and applications in web-based visualization.

---

<a name="2-resource-links"></a>
## 2. Resource Links
Essential resources to help you get started with xeokit SDK:
- [**Examples**](../../examples/index.html) – Interactive demos showcasing SDK features.
- [**Model Viewer**](../../models/index.html) – Explore test models from various AEC formats.
- [**Source Code**](https://github.com/xeokit/sdk) – Open-source repository under the AGPL3 license.
- [**API Documentation**](../../api-docs.html) – Detailed API reference generated with TypeDoc.
- [**User Guide**](../../userguide/index.html) – Guides for effective SDK use.
- [**Releases**](https://github.com/xeokit/sdk/releases) – Latest updates and version history.
- [**NPM Package**](https://www.npmjs.com/package/@xeokit/sdk) – Install the SDK via NPM.

---

<a name="3-use-cases"></a>
## 3. Use Cases
The xeokit SDK supports a wide range of AEC industry use cases:

<a name="31-bim-model-visualization"></a>
##### **3.1. BIM Model Visualization**
- Load and view **IFC, glTF,** and other 3D formats in your web browser.
- Efficiently visualize **large-scale BIM models** with optimized rendering.
- Overlay and compare **federated models** for project coordination.

<a name="32-web-based-bim-collaboration"></a>
##### **3.2. Web-Based BIM Collaboration**
- Supports **BCF (BIM Collaboration Format)** for issue tracking and annotations.
- Enables **real-time collaboration** with shared 3D views.
- Manages **object properties and metadata** via the Data module.

<a name="33-gis-and-lidar-integration"></a>
##### **3.3. GIS and LiDAR Integration**
- Ensures precise geospatial alignment using **double-precision coordinates**.
- Overlays **AEC models with point clouds** (supports LAS/LAZ).
- Ideal for visualizing **large-scale infrastructure** accurately.

<a name="34-interactive-model-analysis"></a>
##### **3.4. Interactive Model Analysis**
- Perform **sectioning, slicing, and x-ray views** for in-depth analysis.
- Use **custom materials and rendering effects** for enhanced visualization.
- Employ **collision detection** to verify model integrity.

<a name="35-web-based-digital-twin-applications"></a>
##### **3.5. Web-Based Digital Twin Applications**
- Integrate **real-time IoT data** with BIM models for facility management.
- Visualize historical and predictive asset maintenance.
- Provide interactive dashboards featuring embedded 3D model viewers.

<a name="36-aec-model-conversion-and-processing"></a>
##### **3.6. AEC Model Conversion and Processing**
- Convert between **BIM formats** with built-in importers/exporters.
- Pre-convert models to **doc:XKT/doc:XGF formats** for optimal performance.
- Process semantic relationships for structured querying.

<a name="37-custom-web-based-3d-applications"></a>
##### **3.7. Custom Web-Based 3D Applications**
- Develop **custom visualization tools** using the xeokit Viewer.
- Embed **high-performance 3D models** into web dashboards.
- Create **multi-view 3D interfaces** for enhanced user experience.

---

<a name="4-features"></a>
## 4. Features
Key features of the xeokit SDK include:
- **Advanced AEC Graphics Toolkit:** Build, load, convert, export, view, and interact with 3D models.
- **Multi-Model Viewing:** Simultaneously display multiple federated models.
- **Multi-Format Support:** Handles IFC, glTF, LAS/LAZ, CityJSON, XKT, XGF, .BIM, and more.
- **Multi-Canvas Support:** Configure different view canvases independently.
- **Double-Precision Coordinates:** Ensure precise geospatial model placement.
- **Optimized Loading:** Pre-conversion to doc:XGF format speeds up performance.
- **High-Performance Rendering:** Built for complex AEC models.
- **Interactive Effects:** Slice, x-ray, highlight, colorize and select objects.
- **BCF Collaboration:** Interoperate with other BIM software through BCF viewpoints.
- **Natively TypeScript:** Leverages strongly-typed components and clear API contracts.

---

<a name="5-viewing-aec-models"></a>
## 5. Viewing AEC Models
The xeokit SDK supports viewing various AEC file formats through multiple import pipelines. 

The best pipeline to use depends on the source format and file size.

The table below outlines the recommended pipeline based on format and data size. Smaller files can be loaded directly
into the xeokit Viewer while medium/large files should be preconverted to a more
compact format, such as to XGF, for optimal
performance. The links on the right take you to the tutorials for the selected pipelines.

<br>

<table class="table table-striped table-bordered table-hover">
  <thead class="thead-dark">
    <tr>
      <th>Model Format</th>
      <th>File Size</th>
      <th>Load Directly vs. Preconvert</th>
      <th>Recommended Articles</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="4"><b style="font-size: 20px;">IFC</b></td>
      <td rowspan="2" style="background-color:#90ee9073">0MB - 10MB</td>
      <td>Load Directly</td>
      <td>
        <a href="@@base/userguide/example_IFCLoader_IfcOpenHouse4/">Viewing IFC using IFCLoader</a>
      </td>
    </tr>
    <tr>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/webifc2xgf/">Viewing IFC using webifc2xgf</a>
      </td>
    </tr>
    <tr>
      <td rowspan="1" style="background-color:lightyellow">10MB - 100MB</td>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/ifc2gltf/">Viewing IFC using ifc2gltf</a><br>
        <a href="">Viewing IFC using ifc2gltf2xgf</a>
      </td>
    </tr>
    <tr>
      <td rowspan="1" style="background-color:#ffa50047">100MB - 2GB</td>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/ifc2gltf2xgf/">Viewing IFC using ifc2gltf2xgf</a>
      </td>
    </tr>
    <tr>
      <td rowspan="2"><b style="font-size: 20px;">glTF</b></td>
      <td rowspan="1" style="background-color:#90ee9073">Small</td>
      <td>Load Directly</td>
      <td>
        <a href="@@base/userguide/example_GLTFLoader_MAP/">Viewing glTF using GLTFLoader</a>
      </td>
    </tr>
    <tr>
      <td rowspan="1" style="background-color:#ffa50047">Medium / Large</td>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/gltf2xgf/">Viewing glTF using gltf2xgf</a>
      </td>
    </tr>
    <tr>
      <td rowspan="2"><b style="font-size: 20px;">.BIM</b></td>
      <td style="background-color:#90ee9073">Small</td>
      <td>Load Directly</td>
      <td><a href="@@base/userguide/example_loadDotBIM_BlenderHouse/">Viewing .BIM using DotBIMLoader</a>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffa50047">Medium / Large</td>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/dotbim2xgf/">Viewing .BIM using dotbim2xgf</a>
      </td>
    </tr>
    <tr>
      <td><b style="font-size: 20px;">CityJSON</b></td>
      <td style="background-color:#90ee9073">All Sizes</td>
      <td>Load Directly</td>
      <td>
        <a href="@@base/userguide/example_CityJSONLoader_Railway/">Viewing CityJSON using CityJSONLoader</a>
      </td>
    </tr>
    <tr>
      <td><b style="font-size: 20px;">LAS/LAZ</b></td>
      <td style="background-color:#90ee9073">All Sizes</td>
      <td>Load Directly</td>
      <td>
        <a href="@@base/userguide/example_LASLoader_Pumpkin/">Viewing LAS/LAZ using LASLoader</a>
      </td>
    </tr>
    <tr>
      <td><b style="font-size: 20px;">XKT</b></td>
      <td style="background-color:#90ee9073">All Sizes</td>
      <td>Load Directly</td>
      <td><a href="@@base/userguide/example_loadXKT_MAP/">Viewing XKT using loadXKT</a></td>
    </tr>
    <tr>
      <td><b style="font-size: 20px;">XGF</b></td>
      <td style="background-color:#90ee9073">All Sizes</td>
      <td>Load Directly</td>
      <td><a href="@@base/userguide/example_XGFLoader_MAP/">Viewing XGF using XGFLoader</a></td>
    </tr>
  </tbody>
</table>


---

<a name="6-code-modules"></a>
## 6. Code Modules
The xeokit SDK is built with a modular design for maximum flexibility and scalability in both browser and Node.js environments. It follows best practices such as:
- [Separation of Concerns](https://en.wikipedia.org/wiki/Separation_of_concerns)
- [Single Responsibility Principle](https://en.wikipedia.org/wiki/Single-responsibility_principle)
- [Open-Closed Principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle)

Main modules include:
- **Scene** – Manages 3D model objects.
- **Data** – Provides a searchable entity-relationship data model.
- **Viewer** – Enables interactive 3D model visualization.
- **Importers/Exporters** – Load and export various AECO formats.
- **Converters** – CLI tools to convert models to an optimized format.
- **BCF Support** – Tools for BIM collaboration.
- **Collision Detection** – Utilities for frustum culling, ray-picking, etc.
- **Utilities** – Core functionalities like math operations and 3D graphics.

---

<a name="61-scene-module"></a>
### 6.1. Scene Module
The Scene module (doc:Scene) represents the model using a scene graph that holds 3D objects, geometries, and materials. This scene graph is agnostic of the viewer and operates on both the browser and NodeJS platforms. It can be used to create models, convert between model formats, and provide content for the SDK's model viewer.

| Module | Description |
|--------|-------------|
| [`@xeokit/sdk/scene`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/scene.html) | Handles model geometries, materials, and more. |


[![](https://mermaid.ink/img/pako:eNqNVE1vozAQ_StoTrsVjSDNlpTrVuplo5WanlZcXHuaeAUY2aZKNsp_38FAYz5SlYvxm-c3n_YJuBIIKfCcGfMo2U6zIiuF1MitVGXw6zkrA_c5RrDlWOKpxxyukVnckEz-7fvAkCPTQ6hoWMZH1Otf8vQBnWe8OWnPpRSX_9HxxgWaPfrADlWBVssBaPFga41btDOoB7XJ_XZe_FS6pMnXFH1qHR6nlpdW_6qBwvFtr7XMhQ8INFYrT3iuXG2wgxb5FRtXaCTRpBRcKTZXudKXrVb1bl-i8cpFebN8CKmKcWmPHodRMw6Xfdcfj3FpzpUgu3LNxznPJbFP0-poo1RyyZ_7LCcMxXleG7okEwsW0hj5jiPDKLJ-Tq7FVWlZSEsyHqSMbK6leUSuiopG1WxG5azfPzF-nP_ZEVAMTs7Bkl4DPpmXfutGLsggzuDm9pbWxeImA-_iDogOucJu5_YrujPMFprym3HuiW60PQaZn0az5w3LQGpF3FEzZ9RevLntaf0KIRSoCyYFPbau4RnYPRaYQUq_At9YndsMsvJMVFZbtT2WHFKrawyhrgS9Et3zDOkbyw2hKKRVetM94M0SQsVKSE9wgDS-_7FIkiheP8SrVXJ3v74L4QhpdA7hn1KkEi-i9ltGyXL5ECVrd_yPM7Z-3RXv_J3_A-vIyXI?type=png)](https://mermaid.live/edit#pako:eNqNVE1vozAQ_StoTrsVjSDNlpTrVuplo5WanlZcXHuaeAUY2aZKNsp_38FAYz5SlYvxm-c3n_YJuBIIKfCcGfMo2U6zIiuF1MitVGXw6zkrA_c5RrDlWOKpxxyukVnckEz-7fvAkCPTQ6hoWMZH1Otf8vQBnWe8OWnPpRSX_9HxxgWaPfrADlWBVssBaPFga41btDOoB7XJ_XZe_FS6pMnXFH1qHR6nlpdW_6qBwvFtr7XMhQ8INFYrT3iuXG2wgxb5FRtXaCTRpBRcKTZXudKXrVb1bl-i8cpFebN8CKmKcWmPHodRMw6Xfdcfj3FpzpUgu3LNxznPJbFP0-poo1RyyZ_7LCcMxXleG7okEwsW0hj5jiPDKLJ-Tq7FVWlZSEsyHqSMbK6leUSuiopG1WxG5azfPzF-nP_ZEVAMTs7Bkl4DPpmXfutGLsggzuDm9pbWxeImA-_iDogOucJu5_YrujPMFprym3HuiW60PQaZn0az5w3LQGpF3FEzZ9RevLntaf0KIRSoCyYFPbau4RnYPRaYQUq_At9YndsMsvJMVFZbtT2WHFKrawyhrgS9Et3zDOkbyw2hKKRVetM94M0SQsVKSE9wgDS-_7FIkiheP8SrVXJ3v74L4QhpdA7hn1KkEi-i9ltGyXL5ECVrd_yPM7Z-3RXv_J3_A-vIyXI)

---

<a name="62-viewer-modules"></a>
### 6.2. Viewer Modules
The Viewer module (doc:Viewer) offers a high-performance 3D viewer for browsers with a pluggable rendering strategy (WebGL/WebGPU). It allows for:
- Simultaneous visualization of multiple models.
- Creation of multiple canvases with customizable elements (lights, section planes, annotations).

| Module | Description |
|--------|-------------|
| [`@xeokit/sdk/viewer`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/viewer.html) | Main browser-based model Viewer |
| [`@xeokit/sdk/cameracontrol`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/cameracontrol.html) | Interactive camera control |
| [`@xeokit/sdk/cameraflight`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/cameraflight.html) | Animates camera transitions |
| [`@xeokit/sdk/webglrenderer`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/webglrenderer.html) | WebGL rendering implementation |
| [`@xeokit/sdk/treeview`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/treeview.html) | HTML tree widget for model hierarchy |
| [`@xeokit/sdk/locale`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/locale.html) | Localization service for Viewer |

[![](https://mermaid.ink/img/pako:eNqNVUtv2kAQ_ivWntoKUEyMAQtxIVJ7ADWCPqTKl7U9CZssu-7apnEI_737dGweVX3xeuabb97rA0p5BihCKcVFcUfwo8C7mGVEQFoSzrzlOmZa5_0g8AeEd4iZZx4BLAMBwgiKFBiY414iC3NMBeASlOmHj0YSs2Ob0fGlmO2xNeLJk_TuGPAOBDZnSh63Tl6YAO8pZmBFFNcgOo6XSuI8G9GmZdfVLBW7EnUC1BQuSpJdiPB3hSkp67Uux4n1Vw08Nd-TgiQUXCJUQsCqtjIInaYTvAgZgD2nnHJBXq1hSkme44YnJ-nz-xfGSdKKZaGr6OKAGjxbMs6fzanKLY3gT6ZELfN20RxJzgvPsshxaff1jghdS4dUagfVKXSmYG3HSKNnM5wUpcBpOZ-3MD8h-bzsALWyCU_NnvO2kwNNL06S7vJKqZvGU8Ci03JNpTH_7LnhMt11ZElFaOY-MpBp8Pqc-3widCJmu2Lkx6jfn-v3utmvC8qNWTfzahSfrMI4uarW-VmtOV9lOHUt9UoU2R1X5zOlsY2agr3LNKSTgsXKKcgFFMDKwiPM-_JttWyuhIs-9FpGbuMbSYxuBoP_CKdTy4W9Ys4cuUGO3MVzhmgvhmpjM6Ozt37_ZGwjj-xyCjuV5CXk_fcr0PYKLziTc9UMp75r9Qh11J0y-KYMqIckYodJJq97bR6jcit9xCiSxwwecEVlhySbhOKq5JuapSgqRQU9VOWZHHj7g0DRA6aFlEJGSi5W9heiXj2UY4aiA3pB0TD0B74_HvnhcHI7DcPpqIdqKR4Oguk4HAVTfzwMJ7ejYw-9ci5ZbwaTYRgE4XAajCfBKBhNNd0vrVRxHP8CUYMzSw?type=png)](https://mermaid.live/edit#pako:eNqNVUtv2kAQ_ivWntoKUEyMAQtxIVJ7ADWCPqTKl7U9CZssu-7apnEI_737dGweVX3xeuabb97rA0p5BihCKcVFcUfwo8C7mGVEQFoSzrzlOmZa5_0g8AeEd4iZZx4BLAMBwgiKFBiY414iC3NMBeASlOmHj0YSs2Ob0fGlmO2xNeLJk_TuGPAOBDZnSh63Tl6YAO8pZmBFFNcgOo6XSuI8G9GmZdfVLBW7EnUC1BQuSpJdiPB3hSkp67Uux4n1Vw08Nd-TgiQUXCJUQsCqtjIInaYTvAgZgD2nnHJBXq1hSkme44YnJ-nz-xfGSdKKZaGr6OKAGjxbMs6fzanKLY3gT6ZELfN20RxJzgvPsshxaff1jghdS4dUagfVKXSmYG3HSKNnM5wUpcBpOZ-3MD8h-bzsALWyCU_NnvO2kwNNL06S7vJKqZvGU8Ci03JNpTH_7LnhMt11ZElFaOY-MpBp8Pqc-3widCJmu2Lkx6jfn-v3utmvC8qNWTfzahSfrMI4uarW-VmtOV9lOHUt9UoU2R1X5zOlsY2agr3LNKSTgsXKKcgFFMDKwiPM-_JttWyuhIs-9FpGbuMbSYxuBoP_CKdTy4W9Ys4cuUGO3MVzhmgvhmpjM6Ozt37_ZGwjj-xyCjuV5CXk_fcr0PYKLziTc9UMp75r9Qh11J0y-KYMqIckYodJJq97bR6jcit9xCiSxwwecEVlhySbhOKq5JuapSgqRQU9VOWZHHj7g0DRA6aFlEJGSi5W9heiXj2UY4aiA3pB0TD0B74_HvnhcHI7DcPpqIdqKR4Oguk4HAVTfzwMJ7ejYw-9ci5ZbwaTYRgE4XAajCfBKBhNNd0vrVRxHP8CUYMzSw)

---

<a name="63-data-module"></a>
### 6.3. Data Module
The Data module (doc:Data) implements an entity-relationship graph to manage model semantics (entities, properties, relationships). It is agnostic of the viewer and scene.

| Module | Description |
|--------|-------------|
| [`@xeokit/sdk/data`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/data.html) | Manages model semantic data |

[![](https://mermaid.ink/img/pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg?type=png)](https://mermaid.live/edit#pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg)

---

<a name="64-model-importer-and-exporter-modules"></a>
### 6.4. Model Importer and Exporter Modules
These functions allow you to import and export model representations and semantic data in various AECO formats, either in Node.js (for file conversion) or in the browser.

| Module | Description |
|--------|-------------|
| [`@xeokit/sdk/xgf`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/xgf.html) | Handles import/export of XKT |
| [`@xeokit/sdk/dotbim`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/dotbim.html) | Handles import/export of .BIM |
| [`@xeokit/sdk/gltf`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/gltf.html) | Imports glTF |
| [`@xeokit/sdk/las`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/las.html) | Imports LAS/LAZ |
| [`@xeokit/sdk/cityjson`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/cityjson.html) | Imports CityJSON |
| [`@xeokit/sdk/webifc`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/webifc.html) | Imports IFC |

---

<a name="65-model-converter-modules"></a>
### 6.5. Model Converter Modules
Command-line tools to convert various model formats into the SDK’s optimized XGF format.

| Module | Description |
|--------|-------------|
| [`@xeokit/sdk/cityjson2xgf`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/cityjson2xgf.html) | Converts CityJSON to XGF |
| [`@xeokit/sdk/dotbim2xgf`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/dotbim2xgf.html) | Converts .BIM to XGF |
| [`@xeokit/sdk/gltf2xgf`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/gltf2xgf.html) | Converts glTF to XGF |
| [`@xeokit/sdk/ifc2gltf2xgf`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/ifc2gltf2xgf.html) | Converts IFC output to XGF |
| [`@xeokit/sdk/las2xgf`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/las2xgf.html) | Converts LAS/LAZ to XGF |
| [`@xeokit/sdk/webifc2xgf`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/webifc2xgf.html) | Converts IFC to XGF |

---

<a name="66-bcf-support-module"></a>
### 6.6. BCF Support Module
These functions allow sharing viewer state as industry-standard BCF Viewpoints for collaboration.

| Module | Description |
|--------|-------------|
| [`@xeokit/sdk/bcf`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/bcf.html) | Load and export BCF |

---

<a name="67-collision-detection-modules"></a>
### 6.7. Collision Detection Modules
Collision detection utilities support functions like frustum culling, ray-picking, and marquee selection.

| Module | Description |
|--------|-------------|
| [`@xeokit/sdk/kdtree2`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/kdtree2.html) | 2D k-d tree search and collision tests |
| [`@xeokit/sdk/kdtree3`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/kdtree3.html) | 3D k-d tree search and collision tests |
| [`@xeokit/sdk/pick`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/pick.html) | Object selection using rays and boundaries |

---

<a name="68-utility-library-modules"></a>
### 6.8. Utility Library Modules
A collection of low-level utility libraries used throughout the SDK.

| Module | Description |
|--------|-------------|
| [`@xeokit/sdk/components`](./docs/modules/core.html) | Core component types |
| [`@xeokit/sdk/constants`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/constants.html) | Constants used throughout the SDK |
| [`@xeokit/sdk/utils`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/utils.html) | Core utility functions |
| [`@xeokit/sdk/basictypes`](https://xeokit.github.io/sdk/api-docs.html) | Basic semantic data type constants |
| [`@xeokit/sdk/ifctypes`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/ifcTypes.html) | IFC data type constants |
| [`@xeokit/sdk/math/math`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/math.html) | Math definitions and constants |
| [`@xeokit/sdk/boundaries`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/boundaries.html) | Boundary math functions |
| [`@xeokit/sdk/compression`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/compression.html) | Geometry compression utilities |
| [`@xeokit/sdk/curves`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/curves.html) | Spline curves math library |
| [`@xeokit/sdk/procgen`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/procgen.html) | Procedural geometry generation |
| [`@xeokit/sdk/matrix`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/matrix.html) | Matrix and vector math utilities |
| [`@xeokit/sdk/rtc`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/rtc.html) | Relative-to-center (RTC) coordinate math |
| [`@xeokit/sdk/webglutils`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/webglutils.html) | WebGL utility functions |
| [`@xeokit/sdk/ktx2`](https://xeokit.github.io/sdk/api-docs.html#https://xeokit.github.io/sdk/docs/api/modules/ktx2.html) | Compressed texture support |

---

<a name="7-usage-examples"></a>
## 7. Usage Examples

<br>

<a name="71-example-view-an-ifc-model-and-hide-all-ifcspaces"></a>
### 7.1. Example: example-title:IFCLoader_IfcOpenHouse4

example-description:IFCLoader_IfcOpenHouse4  

<br>

example-run:IFCLoader_IfcOpenHouse4

#### HTML

Create an HTML page in `index.html` that contains a canvas element:  

example-html:IFCLoader_IfcOpenHouse4

#### JavaScript

Then create JavaScript in `index.js` to create the doc:Viewer and view our converted model.  

The steps in the JavaScript are as follows:  

example-javascript:IFCLoader_IfcOpenHouse4

--- 

